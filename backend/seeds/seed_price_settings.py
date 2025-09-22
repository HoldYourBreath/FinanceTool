# backend/seeds/seed_price_settings.py
# ruff: noqa: E402
from __future__ import annotations

import argparse
import json
import os
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any

# --- Resolve paths so "backend.*" imports work from repo root or backend/ ---
THIS_FILE = Path(__file__).resolve()
SCRIPT_DIR = THIS_FILE.parent
BACKEND_DIR = SCRIPT_DIR.parent if SCRIPT_DIR.name in {"seeds", "scripts"} else SCRIPT_DIR
REPO_ROOT = BACKEND_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# --- Optional .env loading (both repo and backend dirs supported) ---
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

# --- Import ONLY from backend.* so we share the app-registered db instance ---
from backend.app import create_app
from backend.models.models import PriceSettings, db

# ------------------------------------------------------------------------------
# Config
# ------------------------------------------------------------------------------
ENV_FILE_VAR = "SEED_FILE_PRICE_SETTINGS"  # direct file override
ENV_DIR_VAR = "SEED_DIR"  # directory override (demo/private/common)

CAND_FILENAMES = (
    "seed_price_settings.json",
    "price_settings.json",
    "settings_prices.json",
)

DEFAULTS: dict[str, Any] = {
    "el_price_ore_kwh": 250,  # öre/kWh
    "diesel_price_sek_litre": 15.0,  # SEK/litre
    "bensin_price_sek_litre": 14.0,  # SEK/litre
    "yearly_km": 18000,  # km/year
    "daily_commute_km": 30,  # km/day
    "downpayment_sek": 0,  # SEK amount
    "interest_rate_pct": 5,  # %
}

# Allow overriding single values via env vars
ENV_VALUE_MAP: dict[str, tuple[str, ...]] = {
    "el_price_ore_kwh": ("EL_PRICE_ORE_KWH", "ELECTRICITY_PRICE_ORE_KWH"),
    "diesel_price_sek_litre": ("DIESEL_PRICE_SEK_LITRE",),
    "bensin_price_sek_litre": ("BENSIN_PRICE_SEK_LITRE", "GAS_PRICE_SEK_LITRE"),
    "yearly_km": ("YEARLY_KM", "YEARLY_DRIVING_KM"),
    "daily_commute_km": ("DAILY_COMMUTE_KM",),
    "downpayment_sek": ("DOWNPAYMENT_SEK",),
    "interest_rate_pct": ("INTEREST_RATE_PCT",),
}


# ------------------------------------------------------------------------------
# Seed file resolution
# ------------------------------------------------------------------------------
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


# ------------------------------------------------------------------------------
# Coercion helpers
# ------------------------------------------------------------------------------
def _to_decimal(v: Any) -> Decimal:
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    if isinstance(v, int | float):
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
def _load_payload(seed_file: Path | None) -> dict[str, Any]:
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


def _merge_env_overrides(values: dict[str, Any]) -> dict[str, Any]:
    out = dict(values)
    for key, env_names in ENV_VALUE_MAP.items():
        for env in env_names:
            v = os.getenv(env)
            if v is not None and v.strip() != "":
                out[key] = v
                break
    return out


def _sanitize(values: dict[str, Any]) -> dict[str, Any]:
    return {
        "el_price_ore_kwh": _to_int(values.get("el_price_ore_kwh", DEFAULTS["el_price_ore_kwh"])),
        "diesel_price_sek_litre": _to_float(
            values.get("diesel_price_sek_litre", DEFAULTS["diesel_price_sek_litre"])
        ),
        "bensin_price_sek_litre": _to_float(
            values.get("bensin_price_sek_litre", DEFAULTS["bensin_price_sek_litre"])
        ),
        "yearly_km": _to_int(values.get("yearly_km", DEFAULTS["yearly_km"])),
        "daily_commute_km": _to_int(values.get("daily_commute_km", DEFAULTS["daily_commute_km"])),
        "downpayment_sek": _to_int(values.get("downpayment_sek", DEFAULTS["downpayment_sek"])),
        "interest_rate_pct": _to_int(
            values.get("interest_rate_pct", DEFAULTS["interest_rate_pct"])
        ),
    }


# ------------------------------------------------------------------------------
# Seeding
# ------------------------------------------------------------------------------
def seed(
    seed_path: str | None = None,
    row_id: int = 1,
    overwrite: bool = False,
    dry_run: bool = False,
) -> None:
    """
    Upserts a single PriceSettings row (default id=1).

    - overwrite=False (default): only fills fields that are currently None.
    - overwrite=True: replaces fields with provided values.
    """
    app = create_app()
    seed_file = _resolve_seed_path(seed_path)

    print(f"📂 CWD: {Path.cwd()}")
    print(f"📄 Seed file: {seed_file if seed_file else '(none → using env/defaults)'}")
    print(
        f"🧪 Dry run: {'yes' if dry_run else 'no'} / Overwrite existing: {'yes' if overwrite else 'no'} / Row id: {row_id}"
    )

    raw_values = _load_payload(seed_file)
    raw_values = _merge_env_overrides(raw_values)
    values = _sanitize(raw_values)

    with app.app_context():
        # SQLAlchemy 2.0 style: use the session directly
        row = db.session.get(PriceSettings, row_id)
        created = False
        if not row:
            row = PriceSettings(id=row_id)
            db.session.add(row)
            created = True

        before = {
            "el_price_ore_kwh": row.el_price_ore_kwh,
            "diesel_price_sek_litre": row.diesel_price_sek_litre,
            "bensin_price_sek_litre": row.bensin_price_sek_litre,
            "yearly_km": row.yearly_km,
            "daily_commute_km": row.daily_commute_km,
            "downpayment_sek": row.downpayment_sek,
            "interest_rate_pct": row.interest_rate_pct,
        }

        # Only fill Nones unless --overwrite is set
        for key, new_val in values.items():
            cur = getattr(row, key, None)
            if overwrite or cur is None:
                setattr(row, key, new_val)

        after = {
            "el_price_ore_kwh": row.el_price_ore_kwh,
            "diesel_price_sek_litre": row.diesel_price_sek_litre,
            "bensin_price_sek_litre": row.bensin_price_sek_litre,
            "yearly_km": row.yearly_km,
            "daily_commute_km": row.daily_commute_km,
            "downpayment_sek": row.downpayment_sek,
            "interest_rate_pct": row.interest_rate_pct,
        }

        if dry_run:
            db.session.rollback()
            print(
                f"🔍 Dry-run complete: {'create' if created else 'update'} PriceSettings {row_id}"
            )
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
    ap.add_argument("--file", default=None, help=f"Path to seed file (overrides ${ENV_FILE_VAR})")
    ap.add_argument("--id", type=int, default=1, help="Primary key id to upsert (default: 1)")
    ap.add_argument("--overwrite", action="store_true", help="Overwrite existing values")
    ap.add_argument("--dry-run", action="store_true", help="Show changes without writing")
    return ap.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    seed(
        seed_path=args.file,
        row_id=args.id,
        overwrite=args.overwrite,
        dry_run=args.dry_run,
    )
