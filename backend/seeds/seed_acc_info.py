# scripts/seed_acc_info.py
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# --- locate project roots ----------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent if (SCRIPT_DIR.name == "scripts") else SCRIPT_DIR
REPO_ROOT = BACKEND_DIR.parent

# Ensure we can import app + models whether called from repo root or backend/
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Try both import styles, depending on how you run the app
try:
    from app import create_app  # when running inside backend/
except ImportError:  # running from repo root as a package
    from backend.app import create_app  # type: ignore

try:
    from models.models import AccInfo, db  # when inside backend/
except ImportError:
    from backend.models.models import AccInfo, db  # type: ignore


# --- config ------------------------------------------------------------------
ENV_VAR = "SEED_FILE_ACC_INFO"
DEFAULT_CANDIDATES = (
    REPO_ROOT / "data" / "seed_acc_info.json",
    REPO_ROOT / "seeds" / "seed_acc_info.json",
    BACKEND_DIR / "data" / "seed_acc_info.json",
    BACKEND_DIR / "seeds" / "seed_acc_info.json",
)

FALLBACK_ROWS = [
    {"person": "Demo", "bank": "DemoBank", "acc_number": "0000", "country": "SE", "value": 0}
]


def _resolve_seed_path(cli_path: str | None) -> Path | None:
    # 1) CLI argument
    if cli_path:
        p = Path(cli_path)
        if not p.is_absolute():
            # interpret relative to repo root first, then CWD
            cand = (REPO_ROOT / p)
            if cand.exists():
                return cand
        return p if p.exists() else None

    # 2) Environment variable
    env = os.getenv(ENV_VAR)
    if env:
        p = Path(env)
        if not p.is_absolute():
            cand = (REPO_ROOT / p)
            if cand.exists():
                return cand
        if p.exists():
            return p

    # 3) First existing default candidate
    for cand in DEFAULT_CANDIDATES:
        if cand.exists():
            return cand

    return None


def _load_rows(seed_file: Path | None) -> list[dict]:
    if seed_file and seed_file.exists():
        with seed_file.open(encoding="utf-8") as f:
            data = json.load(f)
        # Support both {"acc_info": [...]} and [...] formats
        if isinstance(data, dict) and "acc_info" in data:
            rows = data["acc_info"]
        else:
            rows = data
        if not isinstance(rows, list):
            raise ValueError("Seed JSON must be a list or contain key 'acc_info' as a list.")
        return rows
    # No file → fallback row so CI never crashes
    return FALLBACK_ROWS


def seed(seed_path: str | None = None, truncate: bool = True) -> None:
    app = create_app()
    seed_file = _resolve_seed_path(seed_path)

    print(f"📂 CWD: {Path.cwd()}")
    print(f"📄 Seed file: {seed_file if seed_file else '(missing → using fallback)'}")

    rows = _load_rows(seed_file)

    with app.app_context():
        if truncate:
            db.session.query(AccInfo).delete()

        inserted = 0
        for item in rows:
            acc = AccInfo(
                person=item.get("person", ""),
                bank=item.get("bank", ""),
                acc_number=item.get("acc_number", ""),
                country=item.get("country", ""),
                value=float(item.get("value", 0) or 0),
            )
            db.session.add(acc)
            inserted += 1

        db.session.commit()
        print(f"✅ Seeded {inserted} acc_info row(s).")


def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Seed AccInfo rows.")
    ap.add_argument("--file", help=f"Path to seed file (overrides ${ENV_VAR})", default=None)
    ap.add_argument("--no-truncate", action="store_true", help="Do not delete existing rows first")
    return ap.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    seed(seed_path=args.file, truncate=not args.no_truncate)
