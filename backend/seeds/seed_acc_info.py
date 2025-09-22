# backend/seeds/seed_acc_info.py
# ruff: noqa: E402
from __future__ import annotations

import argparse
import json
import os
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import delete as sa_delete

from backend.app import create_app
from backend.models.models import AccInfo, db

# --- Make repo imports work whether run from repo root or backend/ ---
THIS_FILE = Path(__file__).resolve()
SCRIPT_DIR = THIS_FILE.parent
BACKEND_DIR = SCRIPT_DIR.parent if SCRIPT_DIR.name in {"seeds", "scripts"} else SCRIPT_DIR
REPO_ROOT = BACKEND_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# --- Optional .env loading (repo and backend dirs) ---
try:
    from dotenv import load_dotenv  # type: ignore

    for env in (
        REPO_ROOT / ".env",
        BACKEND_DIR / ".env",
        REPO_ROOT / ".env.local",
        BACKEND_DIR / ".env.local",
    ):
        if env.exists():
            load_dotenv(env)
except Exception:
    pass

# -------------------------------------------------------------------
# Config
# -------------------------------------------------------------------
ENV_FILE_VAR = "SEED_FILE_ACC_INFO"  # direct file override
ENV_DIR_VAR = "SEED_DIR"  # directory override (demo/private/etc.)
CAND_FILENAMES = ("seed_acc_info.json", "acc_info.json")

FALLBACK_ROWS: list[dict[str, Any]] = [
    {
        "person": "Demo",
        "bank": "DemoBank",
        "acc_number": "0000",
        "country": "SE",
        "value": 0,
    }
]


# -------------------------------------------------------------------
# Seed file resolution
# -------------------------------------------------------------------
def _search_roots():
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
    # 1) CLI flag
    if cli_path:
        p = Path(cli_path)
        if not p.is_absolute():
            for base in (REPO_ROOT, BACKEND_DIR, Path.cwd()):
                cand = base / p
                if cand.exists():
                    return cand
        return p if p.exists() else None

    # 2) Environment variable
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

    # 3) Known filenames in known dirs
    for root in _search_roots():
        for name in CAND_FILENAMES:
            cand = root / name
            if cand.exists():
                return cand

    return None


# -------------------------------------------------------------------
# IO helpers
# -------------------------------------------------------------------
def _to_float(v: Any) -> float:
    if v is None or v == "":
        return 0.0
    if isinstance(v, int | float):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace(",", ".")
        try:
            return float(Decimal(s))
        except Exception:
            return 0.0
    return 0.0


def _load_rows(seed_file: Path | None) -> list[dict]:
    if seed_file and seed_file.exists():
        with seed_file.open(encoding="utf-8") as f:
            data = json.load(f)
        # Support both {"acc_info": [...]} and plain [...]
        rows = data["acc_info"] if isinstance(data, dict) and "acc_info" in data else data
        if not isinstance(rows, list):
            raise ValueError("Seed JSON must be a list or contain key 'acc_info' as a list.")
        return rows
    return FALLBACK_ROWS


# -------------------------------------------------------------------
# Seeding
# -------------------------------------------------------------------
def seed(seed_path: str | None = None, truncate: bool = True, dry_run: bool = False) -> None:
    app = create_app()
    seed_file = _resolve_seed_path(seed_path)

    print(f"📂 CWD: {Path.cwd()}")
    print(f"📄 Seed file: {seed_file if seed_file else '(missing → using fallback)'}")
    print(
        f"🧪 Dry run: {'yes' if dry_run else 'no'} / Truncate first: {'yes' if truncate else 'no'}"
    )

    rows = _load_rows(seed_file)

    with app.app_context():
        if truncate and not dry_run:
            # SQLAlchemy 2.0 style delete ensures we use the app-registered engine/bind
            db.session.execute(sa_delete(AccInfo))
            db.session.commit()

        inserted = 0
        for item in rows:
            acc = AccInfo(
                person=str(item.get("person", "")).strip(),
                bank=str(item.get("bank", "")).strip(),
                acc_number=str(item.get("acc_number", "")).strip(),
                country=str(item.get("country", "")).strip(),
                value=_to_float(item.get("value", 0)),
            )
            db.session.add(acc)
            inserted += 1

        if dry_run:
            db.session.rollback()
            print(f"🔍 Dry-run: would insert {inserted} row(s).")
        else:
            db.session.commit()
            print(f"✅ Seeded {inserted} acc_info row(s).")


# -------------------------------------------------------------------
# CLI
# -------------------------------------------------------------------
def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Seed AccInfo rows.")
    ap.add_argument("--file", default=None, help=f"Path to seed file (overrides ${ENV_FILE_VAR})")
    ap.add_argument("--no-truncate", action="store_true", help="Do not delete existing rows first")
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and show counts without writing",
    )
    return ap.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    seed(seed_path=args.file, truncate=not args.no_truncate, dry_run=args.dry_run)
