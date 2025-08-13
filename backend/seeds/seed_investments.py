import sys
import os
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app
from models.models import Investment, db
app = create_app() 

# 👉 Load filename from environment variable or fallback to example file
SEED_FILE = os.getenv('SEED_FILE_INVESTMENTS', 'data/seed_investments.json')

def seed():
    # Load data from JSON file
    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        investments = data["investments"]

    with app.app_context():
        db.session.query(Investment).delete()
        for item in investments:
            inv = Investment(**item)
            db.session.add(inv)
        db.session.commit()
        print(f"✅ Investments seeded from {SEED_FILE}.")

if __name__ == "__main__":
    seed()
