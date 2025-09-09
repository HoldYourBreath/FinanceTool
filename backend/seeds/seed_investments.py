# backend/seeds/seed_investments.py
from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Iterable
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import delete as sa_delete

# ---- Make repo imports work (run from repo root OR backend/) ----
THIS_FILE = Path(__file__).resolve()
BACKEND_DIR = THIS_FILE.parents[1]        # .../backend
REPO_ROOT = BACKEND_DIR.parent            # repo root
for p in (str(REPO_ROOT),):
    if p not in sys.path:
        sys.path.insert(0, p)

# Load optional .env files
try:
    from dotenv import load_dotenv  # type: ignore
    for env_file in (REPO_ROOT / ".env", BACKEND_DIR / ".env",
                     REPO_ROOT / ".env.local", BACKEND_DIR / ".env.local"):
        if env_file.exists():
            load_dotenv(env_file)
except Exception:
    pass

# ---- Import from backend.* only (single module namespace!) ----
import backend.models.models as models
from backend.app import create_app

db = models.db
Investment = models.Investment

# ---- Config / discovery ----
ENV_FILE_VAR = "SEED_FILE_INVESTMENTS"
ENV_DIR_VAR = "SEED_DIR"
CAND_FILENAMES = ("seed_investments.json", "investments.json")
FALLBACK_ROWS: list[dict] = []

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
    if cli_path:
        p = Path(cli_path)
        if not p.is_absolute():
            for base in (REPO_ROOT, BACKEND_DIR, Path.cwd()):
                cand = base / p
                if cand.exists():
                    return cand
        return p if p.exists() else None

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

    for root in _search_roots():
        for name in CAND_FILENAMES:
            cand = root / name
            if cand.exists():
                return cand
    return None

# ---- Coercion helpers ----
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

def _to_float(v: Any) -> float:
    try:
        return float(_to_decimal(v))
    except Exception:
        return 0.0

def _to_int(v: Any) -> int:
    try:
        return int(_to_decimal(v).to_integral_value())
    except Exception:
        try:
            return int(float(_to_decimal(v)))
        except Exception:
            return 0

def _to_bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    if isinstance(v, str):
        return v.strip().lower() in {"1", "true", "t", "yes", "y", "on"}
    return False

# Map a sloppy dict to Investment columns (best-effort)
def _sanitize_item(item: dict) -> dict:
    cols = {c.name: c for c in Investment.__table__.columns}  # type: ignore[attr-defined]
    out: dict = {}
    for name, col in cols.items():
        if name not in item:
            continue
        raw = item[name]
        t = getattr(col, "type", None)
        try:
            tn = type(t).__name__.lower() if t is not None else ""
            if any(k in tn for k in ("numeric", "float", "real", "double")):
                out[name] = _to_float(raw)
            elif "integer" in tn:
                out[name] = _to_int(raw)
            elif "boolean" in tn:
                out[name] = _to_bool(raw)
            else:
                out[name] = raw.strip() if isinstance(raw, str) else raw
        except Exception:
            out[name] = raw
    return out

# ---- Load rows ----
def _discover_rows(data: Any) -> list[dict]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for k in ("investments", "rows", "data", "items", "entries"):
            if k in data and isinstance(data[k], list):
                return [x for x in data[k] if isinstance(x, dict)]
    return []

def _load_rows(seed_file: Path | None) -> list[dict]:
    if not (seed_file and seed_file.exists()):
        return FALLBACK_ROWS
    with seed_file.open(encoding="utf-8") as f:
        try:
            data = json.load(f)
        except Exception:
            return FALLBACK_ROWS
    return _discover_rows(data)

# ---- Seeding ----
def seed(seed_path: str | None = None, *, truncate: bool = True, dry_run: bool = False) -> None:
    app = create_app()
    with app.app_context():
        seed_file = _resolve_seed_path(seed_path)
        rows = _load_rows(seed_file)
        print(f"📄 investments seed: {seed_file if seed_file else '(missing → seeding nothing)'}")
        print(f"🧪 Dry run: {'yes' if dry_run else 'no'} / Truncate first: {'yes' if truncate else 'no'}")
        print(f"📦 Parsed rows: {len(rows)}")

        if truncate and not dry_run:
            db.session.execute(sa_delete(Investment))
            db.session.commit()

        if dry_run:
            db.session.rollback()
            print("🔍 Dry-run complete")
            return

        inserted = 0
        for r in rows:
            obj = Investment(**_sanitize_item(r))
            db.session.add(obj)
            inserted += 1

        db.session.commit()
        print(f"✅ Seeded {inserted} investments")

# ---- CLI ----
def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Seed Investment rows.")
    ap.add_argument("--file", default=None, help=f"Path to seed file (overrides ${ENV_FILE_VAR})")
    ap.add_argument("--no-truncate", action="store_true", help="Do not delete existing rows first")
    ap.add_argument("--dry-run", action="store_true", help="Validate and show counts without writing")
    return ap.parse_args()

if __name__ == "__main__":
    args = _parse_args()
    seed(seed_path=args.file, truncate=not args.no_truncate, dry_run=args.dry_run)
