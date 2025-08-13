import sys
import os
import json
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app
from models.models import PlannedPurchase, db

app = create_app()

SEED_FILE = os.getenv('SEED_FILE_PURCHASES', 'data/seed_planned_purchases.json')

def seed():
    print(f"📂 Current working directory: {os.getcwd()}")
    print(f"📂 Loading seed file: {SEED_FILE}")

    if not os.path.exists(SEED_FILE):
        print(f"❌ Seed file {SEED_FILE} does not exist!")
        return

    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        file_content = f.read()
        if not file_content.strip():
            print(f"❌ Seed file {SEED_FILE} is empty!")
            return

        data = json.loads(file_content)
        planned_purchases = data["planned_purchases"]

    with app.app_context():
        db.session.query(PlannedPurchase).delete()
        for item in planned_purchases:
            purchase = PlannedPurchase(
                item=item["item"],
                amount=item["amount"],
                date=datetime.strptime(item["date"], '%Y-%m-%d').date() if item.get("date") else None
            )
            db.session.add(purchase)
        db.session.commit()
        print(f"✅ Planned purchases seeded from {SEED_FILE}.")

if __name__ == "__main__":
    seed()
