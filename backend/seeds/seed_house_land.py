# backend/seeds/seed_house_land.py
from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Iterable
from decimal import Decimal
from pathlib import Path

from sqlalchemy import delete as sa_delete

# --- Paths: make "from backend.*" resolvable whether run from repo root or backend/ ---
THIS_FILE = Path(__file__).resolve()
SCRIPT_DIR = THIS_FILE.parent
BACKEND_DIR = SCRIPT_DIR if SCRIPT_DIR.name == "backend" else SCRIPT_DIR.parent  # works for backend/seeds or backend/scripts
REPO_ROOT = BACKEND_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# --- Optional .env ---
try:
    from dotenv import load_dotenv  # type: ignore
    for env in (REPO_ROOT / ".env", BACKEND_DIR / ".env", REPO_ROOT / ".env.local", BACKEND_DIR / ".env.local"):
        if env.exists():
            load_dotenv(env)
except Exception:
    pass

# --- Import ONLY from backend.* so we share the exact same db instance as the app ---
from backend.app import create_app
from backend.models.models import HouseCost, LandCost, db

# --- Config ---
ENV_FILE_VAR_PRIMARY = "SEED_FILE_HOUSE_LAND"
ENV_FILE_VAR_LEGACY = "SEED_FILE"
ENV_DIR_VAR = "SEED_DIR"
CAND_FILENAMES = ("seed_house_land.json", "house_land.json")
FALLBACK_LAND: list[dict] = []
FALLBACK_HOUSE: list[dict] = []

# --- Path resolution ---
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

    for var in (ENV_FILE_VAR_PRIMARY, ENV_FILE_VAR_LEGACY):
        env_file = os.getenv(var)
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

# --- Data loading ---
def _to_amount(v) -> float:
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

def _norm_status(v) -> str:
    s = "pending" if v is None else str(v).strip()
    return s or "pending"

def _coerce_item(it: dict) -> dict:
    return {
        "name": str(it.get("name", "")).strip(),
        "amount": _to_amount(it.get("amount", 0)),
        "status": _norm_status(it.get("status", "pending")),
    }

def _load_payload(seed_file: Path | None) -> tuple[list[dict], list[dict]]:
    if not (seed_file and seed_file.exists()):
        return (FALLBACK_LAND, FALLBACK_HOUSE)

    with seed_file.open(encoding="utf-8") as f:
        data = json.load(f)

    land: list[dict] = []
    house: list[dict] = []

    if isinstance(data, dict):
        if "landCosts" in data or "houseBuildingCosts" in data:
            land = data.get("landCosts", []) or []
            house = data.get("houseBuildingCosts", []) or []
        elif "land" in data or "house" in data:
            land = data.get("land", []) or []
            house = data.get("house", []) or []
        elif isinstance(data.get("items"), list):
            for it in data["items"]:
                kind = str(it.get("kind", "")).lower()
                if kind in ("land", "landcost", "land_cost"):
                    land.append(it)
                elif kind in ("house", "building", "house_building", "housecost"):
                    house.append(it)
        else:
            house = data.get("houseBuildingCosts", data.get("house", [])) or []
    elif isinstance(data, list):
        house = data
    else:
        return (FALLBACK_LAND, FALLBACK_HOUSE)

    return ([_coerce_item(x) for x in land if isinstance(x, dict)],
            [_coerce_item(x) for x in house if isinstance(x, dict)])

# --- Seeding ---
def seed(seed_path: str | None = None, truncate: bool = True, dry_run: bool = False) -> None:
    app = create_app()
    seed_file = _resolve_seed_path(seed_path)
    print(f"📂 CWD: {Path.cwd()}")
    print(f"📄 Seed file: {seed_file if seed_file else '(missing → seeding nothing)'}")
    print(f"🧪 Dry run: {'yes' if dry_run else 'no'} / Truncate first: {'yes' if truncate else 'no'}")

    land_costs, house_costs = _load_payload(seed_file)
    print(f"📦 Parsed: land={len(land_costs)} item(s), house={len(house_costs)} item(s)")

    with app.app_context():
        if truncate and not dry_run:
            db.session.execute(sa_delete(HouseCost))
            db.session.execute(sa_delete(LandCost))
            db.session.commit()

        ins_land = ins_house = 0

        for cost in land_costs:
            db.session.add(LandCost(**cost))
            ins_land += 1

        for cost in house_costs:
            db.session.add(HouseCost(**cost))
            ins_house += 1

        if dry_run:
            db.session.rollback()
            print(f"🔍 Dry-run complete: would insert {ins_land} land and {ins_house} house rows.")
        else:
            db.session.commit()
            print(f"✅ Seeded {ins_land} land and {ins_house} house rows.")

# --- CLI ---
def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Seed LandCost and HouseCost rows.")
    ap.add_argument("--file", default=None,
                    help=f"Path to seed file (overrides ${ENV_FILE_VAR_PRIMARY} / ${ENV_FILE_VAR_LEGACY})")
    ap.add_argument("--no-truncate", action="store_true", help="Do not delete existing rows first")
    ap.add_argument("--dry-run", action="store_true", help="Validate and show counts without writing")
    return ap.parse_args()

if __name__ == "__main__":
    args = _parse_args()
    seed(seed_path=args.file, truncate=not args.no_truncate, dry_run=args.dry_run)
