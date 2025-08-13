import json
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app
from models.models import AccInfo, db

app = create_app()

# 👉 Load filename from environment variable or fallback to example file
SEED_FILE = os.getenv('SEED_FILE_ACC_INFO', 'data/seed_acc_info.json')

def seed():
    print(f"📂 Current working directory: {os.getcwd()}")
    print(f"📂 Loading seed file: {SEED_FILE}")

    if not os.path.exists(SEED_FILE):
        print(f"❌ Seed file {SEED_FILE} does not exist!")
        return

    with open(SEED_FILE, encoding='utf-8') as f:
        data = json.load(f)
        acc_infos = data["acc_info"]

    with app.app_context():
        db.session.query(AccInfo).delete()

        for item in acc_infos:
            db.session.add(AccInfo(
                person=item["person"],
                bank=item["bank"],
                acc_number=item["acc_number"],
                country=item["country"],
                value=item["value"]
            ))

        db.session.commit()
        print(f"✅ acc_info values seeded from {SEED_FILE}.")

if __name__ == "__main__":
    seed()
