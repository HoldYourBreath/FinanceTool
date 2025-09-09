# backend/seeds/seed_planned_purchases.py
from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Iterable
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import delete as sa_delete

# --- Make "from backend.*" resolvable no matter where we run from ---
THIS_FILE = Path(__file__).resolve()
SCRIPT_DIR = THIS_FILE.parent
BACKEND_DIR = SCRIPT_DIR.parent if SCRIPT_DIR.name in {"seeds", "scripts"} else SCRIPT_DIR
REPO_ROOT = BACKEND_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# --- Optional .env loading (repo and backend dirs) ---
try:
    from dotenv import load_dotenv  # type: ignore
    for env in (REPO_ROOT / ".env", BACKEND_DIR / ".env",
                REPO_ROOT / ".env.local", BACKEND_DIR / ".env.local"):
        if env.exists():
            load_dotenv(env)
except Exception:
    pass

# --- Import ONLY from backend.* so we share the same db instance as the app ---
from backend.app import create_app
from backend.models.models import PlannedPurchase, db

# ------------------------------------------------------------------------------
# Config
# ------------------------------------------------------------------------------
ENV_FILE_VAR = "SEED_FILE_PURCHASES"  # direct file path override
ENV_DIR_VAR = "SEED_DIR"              # directory override (demo/private/common)

CAND_FILENAMES = (
    "seed_planned_purchases.json",
    "planned_purchases.json",
    "purchases.json",
)

FALLBACK_ROWS: list[dict] = []

# ------------------------------------------------------------------------------
# Path resolution
# ------------------------------------------------------------------------------
def _search_roots() -> Iterable[Path]:
    env_dir = os.getenv(ENV_DIR_VAR)
    if env_dir:
        p = Path(env_dir)
        yield (REPO_ROOT / p) if not p.is_absolute() else p

    yield BACKEND_DIR / "seeds" / "private"
    yield BACKEND_DIR / "seeds" / "common"
    yield BACKEND_DIR / "seeds"
    yield BACKEND_DIR / "data"
    yield REPO_ROOT / "seeds"
    yield REPO_ROOT / "data"


def _resolve_seed_path(cli_path: str | None) -> Path | None:
    # 1) CLI argument
    if cli_path:
        p = Path(cli_path)
        if not p.is_absolute():
            for base in (REPO_ROOT, BACKEND_DIR, Path.cwd()):
                cand = base / p
                if cand.exists():
                    return cand
        return p if p.exists() else None

    # 2) Direct file via env var
    env_file = os.getenv(ENV_FILE_VAR)
    if env_file:
        p = Path(env_file)
        if not p.is_absolute():
            for base in (REPO_ROOT, BACKEND_DIR):
                cand = base / p
                if cand.exists():
                    return cand
        if p.exists():
            return p

    # 3) Search known roots for known filenames
    for root in _search_roots():
        for name in CAND_FILENAMES:
            cand = root / name
            if cand.exists():
                return cand

    return None

# ------------------------------------------------------------------------------
# Coercion helpers
# ------------------------------------------------------------------------------
def _to_decimal(v: Any) -> Decimal:
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    if isinstance(v, (int, float)):
        return Decimal(str(v))
    if isinstance(v, str):
        s = v.strip().replace(",", ".")
        try:
            return Decimal(s)
        except Exception:
            return Decimal("0")
    return Decimal("0")


def _to_amount(v: Any) -> float:
    try:
        return float(_to_decimal(v))
    except Exception:
        return 0.0


def _parse_date(v: Any) -> date | None:
    if v is None:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            iso = s.replace("Z", "+00:00") if s.endswith("Z") else s
            return datetime.fromisoformat(iso).date()
        except Exception:
            pass
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d.%m.%Y", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except Exception:
                continue
    return None


def _sanitize_item(item: dict) -> dict | None:
    """
    Normalize keys and keep only columns that exist on PlannedPurchase.
    Accepts either:
      - {"item": "...", "amount": 123, "date": "YYYY-MM-DD"}
      - {"name": "..."} or {"description": "..."} as fallback for item
    """
    item_name = str(item.get("item") or item.get("name") or item.get("description") or "").strip()
    if not item_name:
        return None  # skip empty entries

    amount = _to_amount(item.get("amount", 0))
    dt = _parse_date(item.get("date"))
    return {"item": item_name, "amount": amount, "date": dt}

# ------------------------------------------------------------------------------
# Data loading
# ------------------------------------------------------------------------------
def _load_rows(seed_file: Path | None) -> list[dict]:
    """
    Supports:
      1) {"planned_purchases":[...]}  <-- preferred
      2) {"purchases":[...]}
      3) [{"item": "...", ...}, ...]  (top-level list)
    """
    if seed_file and seed_file.exists():
        with seed_file.open(encoding="utf-8") as f:
            raw = f.read().strip()
            if not raw:
                return FALLBACK_ROWS
            data = json.loads(raw)

        if isinstance(data, dict):
            rows = data.get("planned_purchases")
            if rows is None:
                rows = data.get("purchases", [])
        else:
            rows = data

        if not isinstance(rows, list):
            raise ValueError(
                "Seed JSON must be a list or contain key 'planned_purchases'/'purchases' as a list."
            )
        return rows

    return FALLBACK_ROWS

# ------------------------------------------------------------------------------
# Seeding
# ------------------------------------------------------------------------------
def seed(seed_path: str | None = None, truncate: bool = True, dry_run: bool = False) -> None:
    app = create_app()
    seed_file = _resolve_seed_path(seed_path)

    print(f"📂 CWD: {Path.cwd()}")
    print(f"📄 Seed file: {seed_file if seed_file else '(missing → seeding nothing)'}")
    print(f"🧪 Dry run: {'yes' if dry_run else 'no'} / Truncate first: {'yes' if truncate else 'no'}")

    raw_rows = _load_rows(seed_file)
    rows = [_sanitize_item(r) for r in raw_rows if isinstance(r, dict)]
    rows = [r for r in rows if r is not None]
    print(f"📦 Parsed planned purchases: {len(rows)} row(s)")

    with app.app_context():
        if truncate and not dry_run:
            db.session.execute(sa_delete(PlannedPurchase))
            db.session.commit()

        inserted = 0
        for item in rows:
            db.session.add(PlannedPurchase(**item))  # item, amount, date
            inserted += 1

        if dry_run:
            db.session.rollback()
            print(f"🔍 Dry-run complete: would insert {inserted} planned purchase row(s).")
        else:
            db.session.commit()
            print(f"✅ Seeded {inserted} planned purchase row(s).")

# ------------------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------------------
def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Seed PlannedPurchase rows.")
    ap.add_argument("--file", default=None, help=f"Path to seed file (overrides ${ENV_FILE_VAR})")
    ap.add_argument("--no-truncate", action="store_true", help="Do not delete existing rows first")
    ap.add_argument("--dry-run", action="store_true", help="Validate and show counts without writing")
    return ap.parse_args()

if __name__ == "__main__":
    args = _parse_args()
    seed(seed_path=args.file, truncate=not args.no_truncate, dry_run=args.dry_run)
