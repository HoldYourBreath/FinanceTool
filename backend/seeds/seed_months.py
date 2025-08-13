import json
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from sqlalchemy import text

from app import create_app
from models.models import Expense, Income, LoanAdjustment, Month, db

app = create_app()

# Category map (unchanged)
CATEGORY_MAP = {
    "Rent": "Housing",
    "Loan Payment": "Housing",
    "Staffanstorps kommun": "Housing",
    "Anslutning EL": "Housing",
    "House Costs": "Housing",

    "Car Insurance": "Transportation",
    "Car Diesel": "Transportation",
    "Car Tax": "Transportation",
    "Car Maintenance": "Transportation",
    "Car tire change": "Transportation",
    "Car Parking": "Transportation",
    "Public Transport": "Transportation",

    "Foods": "Food",
    "Groceries": "Food",

    "Daycare": "Childcare and Family",
    "Phones": "Phones",
    "Subscriptions": "Subscriptions",
    "Union": "Union and Insurance",
    "Dentist": "Other",
    "Olivers Birthday": "Entertainment and Leisure",
    "Moving Company": "Entertainment and Leisure",
    "Presents": "Entertainment and Leisure",
    "Christmas Extra Costs": "Entertainment and Leisure",
    "New Years Party": "Entertainment and Leisure",

    "Vacation": "Entertainment and Leisure",
    "Other": "Other"
}

# File path
SEED_FILE = os.getenv('SEED_FILE_MONTHS', 'data/seed_months.json')

def seed():
    print(f"📂 Current working directory: {os.getcwd()}")
    print(f"📂 Loading seed file: {SEED_FILE}")

    if not os.path.exists(SEED_FILE):
        print(f"❌ Seed file {SEED_FILE} does not exist!")
        return

    with open(SEED_FILE, encoding='utf-8') as f:
        file_content = f.read()
        if not file_content.strip():
            print(f"❌ Seed file {SEED_FILE} is empty!")
            return

        data = json.loads(file_content)
        months_data = data["months"]  # ✅ This line loads months from JSON

    with app.app_context():
        db.session.execute(text("DELETE FROM incomes"))
        db.session.execute(text("DELETE FROM expenses"))
        db.session.execute(text("DELETE FROM loan_adjustments"))
        db.session.execute(text("DELETE FROM months"))
        db.session.commit()

        for data in months_data:
            month = Month(
                name=data["name"],
                starting_funds=data.get("starting_funds", 0),
                month_date=data.get("month_date"),
                is_current=data.get("is_current", False)
            )

            for inc in data.get("incomes", []):
                month.incomes.append(Income(
                    name=inc["name"],
                    amount=inc["amount"],
                    source=inc.get("source", inc["name"])
                ))

            for exp in data.get("expenses", []):
                name = exp["name"]
                month.expenses.append(Expense(
                    amount=exp["amount"],
                    description=name,
                    category=CATEGORY_MAP.get(name, "Other")
                ))

            for adj in data.get("loan_adjustments", []):
                month.loan_adjustments.append(LoanAdjustment(
                    name=adj["name"],
                    amount=adj["amount"],
                    note=adj.get("note"),
                    type=adj.get("type")
                ))

            db.session.add(month)

        db.session.commit()
        print(f"✅ Months seeded from {SEED_FILE}.")


if __name__ == "__main__":
    seed()
