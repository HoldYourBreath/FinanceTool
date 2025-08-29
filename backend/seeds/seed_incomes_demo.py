# backend/seeds/seed_incomes_demo.py
from __future__ import annotations
import os, random
from datetime import datetime, timezone
from sqlalchemy import text
from backend.models.models import db, Month, Income

# You can use 2-tuples (label, base) or 3-tuples (label, person, base)
DEMO_SALARIES = [
    ("Net Salary - Luke", "Luke", 30000),
    ("Net Salary - Leia", 25000),  # person omitted → becomes None
]

def _with_jitter(amount: float, pct: float = 0.02) -> float:
    return round(amount * (1.0 + pct * (random.random() * 2 - 1)), 2)

def main() -> None:
    if (os.getenv("APP_ENV") or "").lower() != "demo":
        raise SystemExit("Refusing to run: APP_ENV is not 'demo'.")

    url = str(db.engine.url)
    if not url.endswith("_demo") and "financial_tracker_demo" not in url:
        raise SystemExit(f"Refusing to run: not a demo DB ({url}).")

    # Start clean
    if db.engine.dialect.name.startswith("postgres"):
        db.session.execute(text("TRUNCATE TABLE incomes RESTART IDENTITY CASCADE;"))
    else:
        db.session.execute(text("DELETE FROM incomes;"))

    months = Month.query.order_by(Month.month_date.asc()).all()
    now = datetime.now(timezone.utc)
    total = 0

    for i, m in enumerate(months):
        random.seed(4242 + i)  # stable but varies by month
        for entry in DEMO_SALARIES:
            if len(entry) == 3:
                label, person, base = entry
            elif len(entry) == 2:
                label, base = entry
                person = None
            else:
                raise ValueError(f"Bad DEMO_SALARIES entry: {entry!r}")

            amt = _with_jitter(float(base), 0.02)
            row = Income(month_id=m.id, source=label, amount=amt, created_at=now)
            if hasattr(Income, "person"):
                setattr(row, "person", person)
            if hasattr(Income, "name"):
                setattr(row, "name", label)
            db.session.add(row)
            total += 1

    db.session.commit()
    print(f"✅ Seeded {total} net-salary incomes into {url} across {len(months)} months.")

if __name__ == "__main__":
    from backend.app import create_app
    app = create_app()
    with app.app_context():
        main()
