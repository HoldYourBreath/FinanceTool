import json
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app
from models.models import HouseCost, LandCost, db

app = create_app()


# 👉 Load filename from environment variable or fallback to example file
SEED_FILE = os.getenv('SEED_FILE', 'data/seed_house_land.json')

def seed():
    # Load data from JSON file
    with open(SEED_FILE, encoding='utf-8') as f:
        seed_data = json.load(f)

    landCosts = seed_data.get("landCosts", [])
    houseBuildingCosts = seed_data.get("houseBuildingCosts", [])

    with app.app_context():
        db.session.query(HouseCost).delete()
        db.session.query(LandCost).delete()

        for cost in landCosts:
            db.session.add(LandCost(name=cost["name"], amount=cost["amount"], status=cost["status"]))

        for cost in houseBuildingCosts:
            db.session.add(HouseCost(name=cost["name"], amount=cost["amount"], status=cost["status"]))

        db.session.commit()
        print(f"✅ Seeded land and house building costs from {SEED_FILE}.")

if __name__ == "__main__":
    seed()
