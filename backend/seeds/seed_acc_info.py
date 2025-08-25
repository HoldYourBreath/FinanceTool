# scripts/seed_acc_info.py
from __future__ import annotations

import argparse
import json
import os
import sys
from decimal import Decimal
from pathlib import Path
from typing import Iterable, Optional

# ------------------------------------------------------------------------------
# Locate project roots (works whether run from repo root or backend/)
# ------------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent if SCRIPT_DIR.name == "scripts" else SCRIPT_DIR
REPO_ROOT = BACKEND_DIR.parent

for p in (str(BACKEND_DIR), str(REPO_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

# Optional: load .env / .env.local if present
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

# Try both import styles
try:
    from app import create_app  # when running inside backend/
except ImportError:  # running from repo root as a package
    from backend.app import create_app  # type: ignore
try:
    from models.models import AccInfo, db  # when inside backend/
except ImportError:
    from backend.models.models import AccInfo, db  # type: ignore

# ------------------------------------------------------------------------------
# Config
# ------------------------------------------------------------------------------
ENV_FILE_VAR = "SEED_FILE_ACC_INFO"  # direct file override
ENV_DIR_VAR = "SEED_DIR"             # directory override (demo/private/etc.)
# Accept both names for convenience
CAND_FILENAMES = ("seed_acc_info.json", "acc_info.json")

FALLBACK_ROWS = [
    {"person": "Demo", "bank": "DemoBank", "acc_number": "0000", "country": "SE", "value": 0}
]


# ------------------------------------------------------------------------------
# Seed file resolution
# ------------------------------------------------------------------------------
def _search_roots() -> Iterable[Path]:
    """Priority of directories to search when only a filename is known."""
    env_dir = os.getenv(ENV_DIR_VAR)
    if env_dir:
        yield (REPO_ROOT / env_dir) if not os.path.isabs(env_dir) else Path(env_dir)

    # Common convention in this repo
    yield BACKEND_DIR / "seeds" / "private"  # ignored (real data)
    yield BACKEND_DIR / "seeds" / "common"   # committed (shared)
    yield BACKEND_DIR / "seeds"              # generic seeds
    yield BACKEND_DIR / "data"               # legacy
    yield REPO_ROOT / "seeds"
    yield REPO_ROOT / "data"


def _resolve_seed_path(cli_path: Optional[str]) -> Optional[Path]:
    # 1) CLI argument
    if cli_path:
        p = Path(cli_path)
        if not p.is_absolute():
            rp = (REPO_ROOT / p)
            if rp.exists():
                return rp
        return p if p.exists() else None

    # 2) Direct file via env var
    env_file = os.getenv(ENV_FILE_VAR)
    if env_file:
        p = Path(env_file)
        if not p.is_absolute():
            rp = (REPO_ROOT / p)
            if rp.exists():
                return rp
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
# IO helpers
# ------------------------------------------------------------------------------
def _to_float(v) -> float:
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace(",", ".")
        try:
            return float(Decimal(s))
        except Exception:
            return 0.0
    return 0.0


def _load_rows(seed_file: Optional[Path]) -> list[dict]:
    if seed_file and seed_file.exists():
        with seed_file.open(encoding="utf-8") as f:
            data = json.load(f)
        # Support both {"acc_info": [...]} and [...]
        rows = data["acc_info"] if isinstance(data, dict) and "acc_info" in data else data
        if not isinstance(rows, list):
            raise ValueError("Seed JSON must be a list or contain key 'acc_info' as a list.")
        return rows
    return FALLBACK_ROWS


# ------------------------------------------------------------------------------
# Seeding
# ------------------------------------------------------------------------------
def seed(seed_path: Optional[str] = None, truncate: bool = True, dry_run: bool = False) -> None:
    app = create_app()
    seed_file = _resolve_seed_path(seed_path)

    print(f"📂 CWD: {Path.cwd()}")
    print(f"📄 Seed file: {seed_file if seed_file else '(missing → using fallback)'}")
    print(f"🧪 Dry run: {'yes' if dry_run else 'no'} / Truncate first: {'yes' if truncate else 'no'}")

    rows = _load_rows(seed_file)

    with app.app_context():
        if truncate and not dry_run:
            db.session.query(AccInfo).delete()

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
            print(f"🔍 Dry-run complete: would insert {inserted} row(s).")
        else:
            db.session.commit()
            print(f"✅ Seeded {inserted} acc_info row(s).")


# ------------------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------------------
def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Seed AccInfo rows.")
    ap.add_argument("--file", help=f"Path to seed file (overrides ${ENV_FILE_VAR})", default=None)
    ap.add_argument("--no-truncate", action="store_true", help="Do not delete existing rows first")
    ap.add_argument("--dry-run", action="store_true", help="Validate and show counts without writing")
    return ap.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    seed(seed_path=args.file, truncate=not args.no_truncate, dry_run=args.dry_run)
