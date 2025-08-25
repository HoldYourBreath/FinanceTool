# scripts/seed_price_settings.py
from __future__ import annotations

import argparse
import json
import os
import sys
from decimal import Decimal
from pathlib import Path
from typing import Iterable, Optional, Any, Dict

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
    from models.models import db, PriceSettings  # when inside backend/
except ImportError:
    from backend.models.models import db, PriceSettings  # type: ignore

# ------------------------------------------------------------------------------
# Config
# ------------------------------------------------------------------------------
ENV_FILE_VAR = "SEED_FILE_PRICE_SETTINGS"  # direct file path override
ENV_DIR_VAR = "SEED_DIR"                   # directory override (demo/private/common)

# Search for these names in known seed folders if no explicit file is provided
CAND_FILENAMES = (
    "seed_price_settings.json",
    "price_settings.json",
    "settings_prices.json",
)

# Defaults (used if no file/env provided)
DEFAULTS = {
    "el_price_ore_kwh": 250,         # öre/kWh
    "diesel_price_sek_litre": 15.0,  # SEK/litre
    "bensin_price_sek_litre": 14.0,  # SEK/litre
    "yearly_km": 18000,              # km/year
    "daily_commute_km": 30,          # km/day
}

# Allow overriding single values via env vars
ENV_VALUE_MAP = {
    "el_price_ore_kwh": ("EL_PRICE_ORE_KWH", "ELECTRICITY_PRICE_ORE_KWH"),
    "diesel_price_sek_litre": ("DIESEL_PRICE_SEK_LITRE",),
    "bensin_price_sek_litre": ("BENSIN_PRICE_SEK_LITRE", "GAS_PRICE_SEK_LITRE"),
    "yearly_km": ("YEARLY_KM", "YEARLY_DRIVING_KM"),
    "daily_commute_km": ("DAILY_COMMUTE_KM",),
}

# ------------------------------------------------------------------------------
# Path resolution
# ------------------------------------------------------------------------------
def _search_roots() -> Iterable[Path]:
    """Priority of directories to search when only a filename is known."""
    env_dir = os.getenv(ENV_DIR_VAR)
    if env_dir:
        yield (REPO_ROOT / env_dir) if not os.path.isabs(env_dir) else Path(env_dir)

    # Conventional locations in this repo layout
    yield BACKEND_DIR / "seeds" / "private"  # ignored (real data)
    yield BACKEND_DIR / "seeds" / "common"   # committed (shared)
    yield BACKEND_DIR / "seeds"              # committed (demo)
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


def _to_float(v: Any) -> float:
    return float(_to_decimal(v))


def _to_int(v: Any) -> int:
    try:
        return int(_to_decimal(v).to_integral_value())
    except Exception:
        try:
            return int(float(_to_decimal(v)))
        except Exception:
            return 0

# ------------------------------------------------------------------------------
# Input loading
# ------------------------------------------------------------------------------
def _load_payload(seed_file: Optional[Path]) -> Dict[str, Any]:
    """
    Accepts either:
      - {"price_settings": {...}}
      - {"el_price_ore_kwh": 250, ...}
    If no file exists, returns {} so env/defaults can be used.
    """
    if seed_file and seed_file.exists():
        with seed_file.open(encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data.get("price_settings", data)
    return {}

def _merge_env_overrides(values: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(values)
    for key, env_names in ENV_VALUE_MAP.items():
        for env in env_names:
            if env in os.environ and os.environ[env].strip() != "":
                out[key] = os.environ[env]
                break
    return out

def _sanitize(values: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "el_price_ore_kwh": _to_int(values.get("el_price_ore_kwh", DEFAULTS["el_price_ore_kwh"])),
        "diesel_price_sek_litre": _to_float(values.get("diesel_price_sek_litre", DEFAULTS["diesel_price_sek_litre"])),
        "bensin_price_sek_litre": _to_float(values.get("bensin_price_sek_litre", DEFAULTS["bensin_price_sek_litre"])),
        "yearly_km": _to_int(values.get("yearly_km", DEFAULTS["yearly_km"])),
        "daily_commute_km": _to_int(values.get("daily_commute_km", DEFAULTS["daily_commute_km"])),
    }

# ------------------------------------------------------------------------------
# Seeding
# ------------------------------------------------------------------------------
def seed(seed_path: Optional[str] = None, row_id: int = 1, overwrite: bool = False, dry_run: bool = False) -> None:
    """
    Upserts a single PriceSettings row (default id=1).

    - If overwrite=False (default): only fill missing/falsey fields, keep existing non-empty values.
    - If overwrite=True: replace values with those from file/env/defaults.
    """
    app = create_app()
    seed_file = _resolve_seed_path(seed_path)

    print(f"📂 CWD: {Path.cwd()}")
    print(f"📄 Seed file: {seed_file if seed_file else '(none → using env/defaults)'}")
    print(f"🧪 Dry run: {'yes' if dry_run else 'no'} / Overwrite existing: {'yes' if overwrite else 'no'} / Row id: {row_id}")

    raw_values = _load_payload(seed_file)
    raw_values = _merge_env_overrides(raw_values)
    values = _sanitize(raw_values)

    with app.app_context():
        row = PriceSettings.query.get(row_id)
        created = False
        if not row:
            row = PriceSettings(id=row_id)
            db.session.add(row)
            created = True

        # Apply values
        before = {
            "el_price_ore_kwh": row.el_price_ore_kwh,
            "diesel_price_sek_litre": row.diesel_price_sek_litre,
            "bensin_price_sek_litre": row.bensin_price_sek_litre,
            "yearly_km": row.yearly_km,
            "daily_commute_km": row.daily_commute_km,
        }

        for key, new_val in values.items():
            cur = getattr(row, key, None)
            if overwrite or not cur:
                setattr(row, key, new_val)

        after = {
            "el_price_ore_kwh": row.el_price_ore_kwh,
            "diesel_price_sek_litre": row.diesel_price_sek_litre,
            "bensin_price_sek_litre": row.bensin_price_sek_litre,
            "yearly_km": row.yearly_km,
            "daily_commute_km": row.daily_commute_km,
        }

        if dry_run:
            db.session.rollback()
            print(f"🔍 Dry-run complete: {'create' if created else 'update'} PriceSettings {row_id}")
            print(f"   Before: {before}")
            print(f"   After : {after}")
        else:
            db.session.commit()
            action = "Created" if created else "Updated"
            print(f"✅ {action} PriceSettings id={row_id}.")

# ------------------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------------------
def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Seed/Upsert PriceSettings.")
    ap.add_argument("--file", help=f"Path to seed file (overrides ${ENV_FILE_VAR})", default=None)
    ap.add_argument("--id", type=int, default=1, help="Primary key id to upsert (default: 1)")
    ap.add_argument("--overwrite", action="store_true", help="Overwrite existing values instead of only filling blanks")
    ap.add_argument("--dry-run", action="store_true", help="Validate and show changes without writing")
    return ap.parse_args()

if __name__ == "__main__":
    args = _parse_args()
    seed(seed_path=args.file, row_id=args.id, overwrite=args.overwrite, dry_run=args.dry_run)
