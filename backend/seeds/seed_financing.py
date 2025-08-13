# seeders/seed_financing.py

import sys
import os
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app
from models.models import Financing, db

app = create_app() 
SEED_FILE = os.getenv('SEED_FILE_FINANCING', 'data/seed_financing.json')

def seed():
    print(f"📂 Seeding financing from: {SEED_FILE}")

    if not os.path.exists(SEED_FILE):
        print(f"❌ File {SEED_FILE} not found.")
        return

    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        financing_items = data.get("financing", [])

    with app.app_context():
        db.session.query(Financing).delete()
        for item in financing_items:
            db.session.add(Financing(
                name=item["name"],
                value=item["value"]
            ))
        db.session.commit()
        print(f"✅ Financing items seeded from {SEED_FILE}")

if __name__ == "__main__":
    seed()
