# backend/seeds/seed_cars.py
from __future__ import annotations

import json, os, sys
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
sys.path.insert(0, str(ROOT_DIR))

# Optional: load .env
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

from app import create_app  # noqa: E402
from models.models import db, Car  # noqa: E402

# For column type inspection
try:
    from sqlalchemy.sql.sqltypes import Numeric as SANumeric, Float as SAFloat, Integer as SAInteger, String as SAString, Boolean as SABoolean  # type: ignore
except Exception:
    SANumeric = SAFloat = SAInteger = SAString = SABoolean = object  # fallbacks

SEED_FILENAME = "seed_car_evaluation.json"

def seed_search_dirs() -> Iterable[Path]:
    env_dir = os.getenv("SEED_DIR")
    if env_dir:
        yield (ROOT_DIR / env_dir) if not os.path.isabs(env_dir) else Path(env_dir)
    yield BASE_DIR / "private"
    yield BASE_DIR / "common"
    yield BASE_DIR / "data"  # legacy

def resolve_seed(filename: str) -> Path:
    for root in seed_search_dirs():
        cand = root / filename
        if cand.exists():
            return cand
    raise FileNotFoundError(f"Seed file '{filename}' not found in: " + ", ".join(str(p) for p in seed_search_dirs()))

FIELD_MAP: Dict[str, str] = {
    "body_style": "body_style",
    "eu_segment": "eu_segment",
    "suv_tier": "suv_tier",
    "estimated_purchase_price": "estimated_purchase_price",
    "summer_tires_price": "summer_tires_price",
    "winter_tires_price": "winter_tires_price",
    "type_of_vehicle": "type_of_vehicle",
    "consumption_kwh_per_100km": "consumption_kwh_per_100km",
    "consumption_l_per_100km": "consumption_l_per_100km",
    "battery_capacity_kwh": "battery_capacity_kwh",
    "range_km": "range_km",
    "acceleration_0_100": "acceleration_0_100",
    "driven_km": "driven_km",
    "battery_aviloo_score": "battery_aviloo_score",
    "trunk_size_litre": "trunk_size_litre",
    "full_insurance_year": "full_insurance_year",
    "half_insurance_year": "half_insurance_year",
    "car_tax_year": "car_tax_year",
    "repairs_year": "repairs_year",
    # charging
    "dc_peak_kw": "dc_peak_kw",
    "dc_time_min_10_80": "dc_time_min_10_80",
    "dc_time_min_10_80_est": "dc_time_min_10_80_est",
    "dc_time_source": "dc_time_source",
    "ac_onboard_kw": "ac_onboard_kw",
    "ac_time_h_0_100": "ac_time_h_0_100",
    "ac_time_h_0_100_est": "ac_time_h_0_100_est",
    "ac_time_source": "ac_time_source",
}

def _to_float(v: Any) -> Optional[float]:
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    if isinstance(v, str):
        s = v.strip().replace(",", ".")
        if s == "": return None
        try: return float(s)
        except Exception: return None
    try:
        return float(v)  # Decimal etc.
    except Exception:
        return None

def _to_int(v: Any) -> Optional[int]:
    f = _to_float(v)
    if f is None: return None
    try:
        return int(round(f))
    except Exception:
        return None

def _coerce_for_column(attr: str, value: Any) -> Any:
    """Coerce value to the right Python type for Car.<attr> column."""
    if value is None:
        return None
    col = Car.__table__.columns.get(attr, None)  # type: ignore[attr-defined]
    if col is None:
        return value
    t = col.type
    if isinstance(t, SAInteger):
        return _to_int(value)
    if isinstance(t, (SAFloat, SANumeric)):
        return _to_float(value)
    if isinstance(t, SABoolean):
        # treat truthy strings/numbers
        if isinstance(value, bool): return value
        if isinstance(value, (int, float)): return value != 0
        if isinstance(value, str): return value.strip().lower() in {"1","true","t","yes","y","on"}
        return False
    # strings and others
    return str(value).strip() if isinstance(value, str) else value

def set_if_present(row: dict, car: Car, key: str) -> bool:
    if key not in row:
        return False
    attr = FIELD_MAP[key]
    new_val = _coerce_for_column(attr, row[key])
    old_val = getattr(car, attr, None)
    if new_val != old_val:
        setattr(car, attr, new_val)
        return True
    return False

def est_ac_hours(batt_kwh: Optional[float], ac_kw: Optional[float]) -> Optional[float]:
    try:
        b = float(batt_kwh or 0.0); a = float(ac_kw or 0.0)
        if b > 0 and a > 0:
            return round(b / a, 2)
    except Exception:
        pass
    return None

def est_dc_10_80_min(batt_kwh: Optional[float], dc_kw: Optional[float]) -> Optional[float]:
    try:
        b = float(batt_kwh or 0.0); p = float(dc_kw or 0.0)
        if b > 0 and p > 0:
            return round(70.0 * b / p, 2)
    except Exception:
        pass
    return None

def run(dry_run: bool = False) -> None:
    seed_path = resolve_seed(SEED_FILENAME)
    print(f"📂 Loading cars from: {seed_path}")

    with open(seed_path, encoding="utf-8") as f:
        payload = json.load(f)
    rows = payload.get("cars", [])
    if not isinstance(rows, list):
        raise ValueError("Seed JSON must contain a top-level 'cars' list")

    inserted = updated = skipped = 0

    for r in rows:
        model = (r.get("model") or "").strip()
        try:
            year = int(r.get("year") or 0)
        except Exception:
            year = 0
        if not model or not year:
            skipped += 1
            continue

        car = Car.query.filter(
            db.func.lower(Car.model) == model.lower(),
            Car.year == year
        ).one_or_none()

        if not car:
            car = Car(model=model, year=year)
            db.session.add(car)
            inserted += 1

        changed = False
        for k in FIELD_MAP.keys():
            changed |= set_if_present(r, car, k)

        t = (car.type_of_vehicle or "").upper()
        if t in ("EV", "PHEV"):
            if not getattr(car, "ac_onboard_kw", None) or _to_float(getattr(car, "ac_onboard_kw")) in (None, 0.0):
                setattr(car, "ac_onboard_kw", _coerce_for_column("ac_onboard_kw", 11.0))
                changed = True

            if not getattr(car, "ac_time_h_0_100_est", None):
                est = est_ac_hours(_to_float(getattr(car, "battery_capacity_kwh", None)),
                                   _to_float(getattr(car, "ac_onboard_kw", None)))
                if est is not None:
                    setattr(car, "ac_time_h_0_100_est", _coerce_for_column("ac_time_h_0_100_est", est))
                    changed = True

            if (not getattr(car, "dc_time_min_10_80_est", None)) and _to_float(getattr(car, "dc_peak_kw", None)):
                est = est_dc_10_80_min(_to_float(getattr(car, "battery_capacity_kwh", None)),
                                       _to_float(getattr(car, "dc_peak_kw", None)))
                if est is not None:
                    setattr(car, "dc_time_min_10_80_est", _coerce_for_column("dc_time_min_10_80_est", est))
                    changed = True

        if changed and inserted == 0:
            updated += 1

    if dry_run:
        db.session.rollback()
        print(f"🔍 Dry-run complete: {inserted} would be inserted, {updated} updated, {skipped} skipped.")
    else:
        db.session.commit()
        print(f"✅ Done: {inserted} inserted, {updated} updated, {skipped} skipped.")

if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    app = create_app()
    with app.app_context():
        run(dry_run=dry)
