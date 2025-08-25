# scripts/seed_house_land.py
from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Iterable
from decimal import Decimal
from pathlib import Path

# ------------------------------------------------------------------------------
# Locate project roots (works whether run from repo root or backend/)
# ------------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent if SCRIPT_DIR.name == 'scripts' else SCRIPT_DIR
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
    from models.models import HouseCost, LandCost, db  # when inside backend/
except ImportError:
    from backend.models.models import HouseCost, LandCost, db  # type: ignore


# ------------------------------------------------------------------------------
# Config
# ------------------------------------------------------------------------------
# Use a specific env var if available; fall back to the legacy generic one.
ENV_FILE_VAR_PRIMARY = 'SEED_FILE_HOUSE_LAND'
ENV_FILE_VAR_LEGACY = 'SEED_FILE'
ENV_DIR_VAR = 'SEED_DIR'

CAND_FILENAMES = ('seed_house_land.json', 'house_land.json')

# If the seed file is missing, seed nothing (CI-friendly).
FALLBACK_LAND = []
FALLBACK_HOUSE = []


# ------------------------------------------------------------------------------
# Path resolution
# ------------------------------------------------------------------------------
def _search_roots() -> Iterable[Path]:
    """Priority of directories to search when only a filename is known."""
    env_dir = os.getenv(ENV_DIR_VAR)
    if env_dir:
        yield (REPO_ROOT / env_dir) if not os.path.isabs(env_dir) else Path(env_dir)

    # Conventional locations in this repo layout
    yield BACKEND_DIR / 'seeds' / 'private'  # ignored (real data)
    yield BACKEND_DIR / 'seeds' / 'common'  # committed (shared)
    yield BACKEND_DIR / 'seeds'  # committed (demo)
    yield BACKEND_DIR / 'data'  # legacy
    yield REPO_ROOT / 'seeds'
    yield REPO_ROOT / 'data'


def _resolve_seed_path(cli_path: str | None) -> Path | None:
    # 1) CLI argument
    if cli_path:
        p = Path(cli_path)
        if not p.is_absolute():
            rp = REPO_ROOT / p
            if rp.exists():
                return rp
        return p if p.exists() else None

    # 2) Direct file via env var(s)
    for var in (ENV_FILE_VAR_PRIMARY, ENV_FILE_VAR_LEGACY):
        env_file = os.getenv(var)
        if not env_file:
            continue
        p = Path(env_file)
        if not p.is_absolute():
            rp = REPO_ROOT / p
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
# Data loading & normalization
# ------------------------------------------------------------------------------
def _to_amount(v) -> float:
    if v is None or v == '':
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace(',', '.')
        try:
            return float(Decimal(s))
        except Exception:
            return 0.0
    return 0.0


def _norm_status(v) -> str:
    if v is None:
        return 'pending'
    s = str(v).strip()
    return s or 'pending'


def _coerce_item(it) -> dict:
    """Ensure a cost item has the expected shape."""
    return {
        'name': str(it.get('name', '')).strip(),
        'amount': _to_amount(it.get('amount', 0)),
        'status': _norm_status(it.get('status', 'pending')),
    }


def _load_payload(seed_file: Path | None) -> tuple[list[dict], list[dict]]:
    """
    Returns (land_costs, house_costs).

    Supports multiple schemas:
      1) {"landCosts":[...], "houseBuildingCosts":[...]}
      2) {"land":[...], "house":[...]}
      3) {"items":[{"kind":"land"|"building", ...}, ...]}
    """
    if seed_file and seed_file.exists():
        with seed_file.open(encoding='utf-8') as f:
            data = json.load(f)
    else:
        return (FALLBACK_LAND, FALLBACK_HOUSE)

    land, house = [], []

    if isinstance(data, dict):
        if 'landCosts' in data or 'houseBuildingCosts' in data:
            land = data.get('landCosts', []) or []
            house = data.get('houseBuildingCosts', []) or []
        elif 'land' in data or 'house' in data:
            land = data.get('land', []) or []
            house = data.get('house', []) or []
        elif 'items' in data and isinstance(data['items'], list):
            for it in data['items']:
                kind = str(it.get('kind', '')).lower()
                if kind in ('land', 'landcost', 'land_cost'):
                    land.append(it)
                elif kind in ('house', 'building', 'house_building', 'housecost'):
                    house.append(it)
        else:
            # Unknown dict schema → try best-effort: all to house
            house = data.get('houseBuildingCosts', data.get('house', [])) or []
    elif isinstance(data, list):
        # List-only schema → assume house costs
        house = data
    else:
        land, house = FALLBACK_LAND, FALLBACK_HOUSE

    land = [_coerce_item(x) for x in land if isinstance(x, dict)]
    house = [_coerce_item(x) for x in house if isinstance(x, dict)]
    return land, house


# ------------------------------------------------------------------------------
# Seeding
# ------------------------------------------------------------------------------
def seed(seed_path: str | None = None, truncate: bool = True, dry_run: bool = False) -> None:
    app = create_app()
    seed_file = _resolve_seed_path(seed_path)

    print(f'📂 CWD: {Path.cwd()}')
    print(f'📄 Seed file: {seed_file if seed_file else "(missing → seeding nothing)"}')
    print(
        f'🧪 Dry run: {"yes" if dry_run else "no"} / Truncate first: {"yes" if truncate else "no"}'
    )

    land_costs, house_costs = _load_payload(seed_file)
    print(f'📦 Parsed: land={len(land_costs)} item(s), house={len(house_costs)} item(s)')

    with app.app_context():
        if truncate and not dry_run:
            db.session.query(HouseCost).delete()
            db.session.query(LandCost).delete()

        ins_land = ins_house = 0

        for cost in land_costs:
            db.session.add(
                LandCost(
                    name=cost['name'],
                    amount=cost['amount'],
                    status=cost['status'],
                )
            )
            ins_land += 1

        for cost in house_costs:
            db.session.add(
                HouseCost(
                    name=cost['name'],
                    amount=cost['amount'],
                    status=cost['status'],
                )
            )
            ins_house += 1

        if dry_run:
            db.session.rollback()
            print(f'🔍 Dry-run complete: would insert {ins_land} land and {ins_house} house rows.')
        else:
            db.session.commit()
            print(f'✅ Seeded {ins_land} land and {ins_house} house rows.')


# ------------------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------------------
def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description='Seed LandCost and HouseCost rows.')
    ap.add_argument(
        '--file',
        help=f'Path to seed file (overrides ${ENV_FILE_VAR_PRIMARY} / ${ENV_FILE_VAR_LEGACY})',
        default=None,
    )
    ap.add_argument('--no-truncate', action='store_true', help='Do not delete existing rows first')
    ap.add_argument(
        '--dry-run', action='store_true', help='Validate and show counts without writing'
    )
    return ap.parse_args()


if __name__ == '__main__':
    args = _parse_args()
    seed(seed_path=args.file, truncate=not args.no_truncate, dry_run=args.dry_run)
