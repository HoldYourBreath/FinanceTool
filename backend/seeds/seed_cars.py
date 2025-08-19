# scripts/seed_cars.py
import json
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from models.models import Car, db

SEED_FILE = os.getenv('SEED_FILE_CARS', 'data/seed_car_evaluation.json')
UPDATE_EXISTING = os.getenv('SEED_UPDATE_EXISTING', '1') == '1'  # backfill when model+year already exists
ONLY_FILL_EMPTY_CATEGORIES = os.getenv('SEED_ONLY_FILL_EMPTY_CATEGORIES', '1') == '1'

app = create_app()

def to_num(v, default=0.0):
    try:
        if v is None:
            return default
        if isinstance(v, (int, float)):
            return float(v)
        return float(str(v).replace(' ', '').replace('\u00A0', '').replace(',', '.'))
    except Exception:
        return default

def to_int(v, default=0):
    return int(round(to_num(v, default)))

def seed():
    print(f"📂 Loading cars from: {SEED_FILE}")
    if not os.path.exists(SEED_FILE):
        print("❌ JSON not found.")
        return

    with open(SEED_FILE, encoding='utf-8') as f:
        data = json.load(f)

    # Support both {"cars":[...]} and [...] formats
    cars = data.get('cars', data if isinstance(data, list) else [])

    inserted, updated, skipped = 0, 0, 0
    with app.app_context():
        for c in cars:
            model = c.get('model')
            year = c.get('year')
            if not model or year is None:
                continue

            exists = Car.query.filter_by(model=model, year=year).first()

            # Parse categories (may be absent in older files)
            body_style = c.get('body_style')
            eu_segment = c.get('eu_segment')
            suv_tier   = c.get('suv_tier')

            if exists:
                if UPDATE_EXISTING:
                    # Backfill categories (or overwrite if configured)
                    def maybe_set(cur, new):
                        if new is None:
                            return cur
                        if ONLY_FILL_EMPTY_CATEGORIES:
                            return cur or new
                        return new

                    before = (exists.body_style, exists.eu_segment, exists.suv_tier)
                    exists.body_style = maybe_set(exists.body_style, body_style)
                    exists.eu_segment = maybe_set(exists.eu_segment, eu_segment)
                    exists.suv_tier   = maybe_set(exists.suv_tier, suv_tier)
                    after = (exists.body_style, exists.eu_segment, exists.suv_tier)
                    if before != after:
                        updated += 1
                    else:
                        skipped += 1
                else:
                    skipped += 1
                continue

            # Insert new row
            db.session.add(Car(
                model=model,
                year=to_int(year, 0),

                # NEW category fields
                body_style=body_style,
                eu_segment=eu_segment,
                suv_tier=suv_tier,

                # Pricing/specs
                estimated_purchase_price=to_int(c.get('estimated_purchase_price', 0)),
                summer_tires_price=to_num(c.get('summer_tires_price', 0)),
                winter_tires_price=to_num(c.get('winter_tires_price', 0)),

                consumption_kwh_per_100km=to_num(c.get('consumption_kwh_per_100km', 0)),
                consumption_l_per_100km=to_num(c.get('consumption_l_per_100km', 0)),

                type_of_vehicle=c.get('type_of_vehicle') or 'EV',
                battery_capacity_kwh=to_num(c.get('battery_capacity_kwh', 0)),
                range_km=to_int(c.get('range_km', c.get('range', 0)), 0),
                acceleration_0_100=to_num(c.get('acceleration_0_100', 0)),
                driven_km=to_int(c.get('driven_km', 0), 0),
                battery_aviloo_score=to_num(c.get('battery_aviloo_score', 0)),
                trunk_size_litre=to_int(c.get('trunk_size_litre', 0), 0),

                full_insurance_year=to_num(c.get('full_insurance_year', 0)),
                half_insurance_year=to_num(c.get('half_insurance_year', 0)),
                car_tax_year=to_num(c.get('car_tax_year', 0)),
                repairs_year=to_num(c.get('repairs_year', 0)),
            ))
            inserted += 1

        db.session.commit()

    print(f"✅ Seeded {inserted} new cars, updated {updated}, skipped {skipped}.")

if __name__ == "__main__":
    seed()
