import json
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from models.models import Car, db

SEED_FILE = os.getenv('SEED_FILE_CARS', 'data/seed_car_evaluation.json')
app = create_app()

def seed():
    print(f"📂 Loading cars from: {SEED_FILE}")
    if not os.path.exists(SEED_FILE):
        print("❌ JSON not found.")
        return

    with open(SEED_FILE, encoding='utf-8') as f:
        data = json.load(f)
    cars = data.get('cars', [])

    inserted, skipped = 0, 0
    with app.app_context():
        for c in cars:
            exists = Car.query.filter_by(model=c['model'], year=c['year']).first()
            if exists:
                skipped += 1
                continue
            db.session.add(Car(
                model=c['model'],
                year=c['year'],
                estimated_purchase_price=int(c.get('estimated_purchase_price', 0)),
                summer_tires_price=c.get('summer_tires_price', 0),
                winter_tires_price=c.get('winter_tires_price', 0),
                consumption_kwh_per_100km=float(c.get('consumption_kwh_per_100km', 0)),
                type_of_vehicle=c.get('type_of_vehicle', 0),
                battery_capacity_kwh=int(c.get('battery_capacity_kwh', 0)),
                range_km=c.get('range_km', 0),
                acceleration_0_100=c.get('acceleration_0_100', 0),
                driven_km=c.get('driven_km', 0),
                battery_aviloo_score=c.get('battery_aviloo_score', 0),
                trunk_size_litre=c.get('trunk_size_litre', 0),
                full_insurance_year=c.get('full_insurance_year', 0),
                half_insurance_year=c.get('half_insurance_year', 0),
                car_tax_year=c.get('car_tax_year', 0),
                repairs_year=c.get('repairs_year', 0),
            ))
            inserted += 1
        db.session.commit()
    print(f"✅ Seeded {inserted} cars (skipped {skipped}).")

if __name__ == "__main__":
    seed()
