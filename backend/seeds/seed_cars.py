# backend/seeds/seed_cars.py
from __future__ import annotations
import json, sys
from decimal import Decimal
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
sys.path.insert(0, str(ROOT_DIR))

from app import create_app
from models.models import db, Car

CARS_JSON = BASE_DIR / "data" / "seed_car_evaluation.json"

def d(x):
    if x is None or x == "": return None
    try: return Decimal(str(x))
    except: return None

FIELD_MAP = {
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
    # charging fields
    "dc_peak_kw": "dc_peak_kw",
    "dc_time_min_10_80": "dc_time_min_10_80",
    "dc_time_min_10_80_est": "dc_time_min_10_80_est",
    "dc_time_source": "dc_time_source",
    "ac_onboard_kw": "ac_onboard_kw",
    "ac_time_h_0_100": "ac_time_h_0_100",
    "ac_time_h_0_100_est": "ac_time_h_0_100_est",
    "ac_time_source": "ac_time_source",
}

def set_if_present(row, car, key):
    if key not in row:
        return  # do not clobber existing DB value
    val = row[key]
    attr = FIELD_MAP[key]
    # numeric vs text
    if isinstance(val, (int, float)) or (isinstance(val, str) and val.replace('.','',1).isdigit()):
        setattr(car, attr, d(val))
    else:
        setattr(car, attr, val)

def est_ac_hours(batt_kwh, ac_kw):
    try:
        b = float(batt_kwh or 0.0)
        a = float(ac_kw or 0.0)
        if b > 0 and a > 0:
            return Decimal(str(round(b / a, 2)))
    except:
        pass
    return None

def est_dc_10_80_min(batt_kwh, dc_kw):
    # simple, conservative: time ≈ 70% of pack at peak power (minutes)
    try:
        b = float(batt_kwh or 0.0)
        p = float(dc_kw or 0.0)
        if b > 0 and p > 0:
            return Decimal(str(round(70.0 * b / p, 2)))
    except:
        pass
    return None

def run():
    if not CARS_JSON.exists():
        raise FileNotFoundError(f"{CARS_JSON} not found")

    with open(CARS_JSON, encoding="utf-8") as f:
        data = json.load(f)
    rows = data.get("cars", [])

    for r in rows:
        model = (r.get("model") or "").strip()
        year = int(r.get("year") or 0)
        if not model or not year:
            continue

        car = Car.query.filter(
            db.func.lower(Car.model) == model.lower(),
            Car.year == year
        ).one_or_none()
        if not car:
            car = Car(model=model, year=year)
            db.session.add(car)

        # copy fields only when present in JSON
        for k in FIELD_MAP.keys():
            set_if_present(r, car, k)

        t = (car.type_of_vehicle or "").upper()
        if t in ("EV", "PHEV"):
            # default onboard AC to 11 kW if absent/zero
            if not car.ac_onboard_kw or float(car.ac_onboard_kw or 0) <= 0:
                car.ac_onboard_kw = Decimal("11.0")

            # estimate AC time if missing
            if not car.ac_time_h_0_100_est:
                car.ac_time_h_0_100_est = est_ac_hours(car.battery_capacity_kwh, car.ac_onboard_kw)

            # estimate DC 10→80 if missing and we have a peak
            if (not car.dc_time_min_10_80_est) and (car.dc_peak_kw and float(car.dc_peak_kw or 0) > 0):
                car.dc_time_min_10_80_est = est_dc_10_80_min(car.battery_capacity_kwh, car.dc_peak_kw)

    db.session.commit()

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        run()
