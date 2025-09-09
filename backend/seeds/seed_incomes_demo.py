# backend/seeds/seed_incomes_demo.py
from __future__ import annotations

import os
import random
from datetime import datetime, timezone

from sqlalchemy import text

from backend.models.models import Income, Month, db

"""
Demo-only seeder for net salary incomes.

- Requires: APP_ENV=demo
- Requires: PostgreSQL (will refuse any other dialect)
- Idempotent: TRUNCATEs incomes and RESTARTs identity before seeding
"""

# You can use 2-tuples (label, base) or 3-tuples (label, person, base)
DEMO_SALARIES: list[tuple] = [
    ("Net Salary - Luke", "Luke", 30000),
    ("Net Salary - Leia", 25000),  # person omitted → becomes None
]


def _with_jitter(amount: float, pct: float = 0.02) -> float:
    """±pct jitter, rounded to 2 decimals."""
    return round(amount * (1.0 + pct * (random.random() * 2 - 1)), 2)


def main() -> None:
    app_env = (os.getenv("APP_ENV") or "").lower()
    if app_env != "demo":
        raise SystemExit(f"Refusing to run: APP_ENV must be 'demo' (got {app_env!r}).")

    # Enforce PostgreSQL only
    dialect = db.engine.dialect.name  # e.g. 'postgresql'
    if dialect != "postgresql":
        raise SystemExit(f"Refusing to run: demo incomes expects PostgreSQL (got {dialect}).")

    # Hard reset incomes
    db.session.execute(text("TRUNCATE TABLE incomes RESTART IDENTITY CASCADE;"))

    months = Month.query.order_by(Month.month_date.asc()).all()
    if not months:
        print("⚠️  No months found; nothing to seed.")
        db.session.commit()
        return

    now = datetime.now(timezone.utc)
    rows: list[Income] = []
    total = 0

    for i, m in enumerate(months):
        # Stable per-month randomness (repeatable, but different across months)
        random.seed(4242 + i)

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

            # Be schema-flexible: fill optional columns if they exist
            if hasattr(Income, "person"):
                row.person = person
            if hasattr(Income, "name"):
                row.name = label

            rows.append(row)
            total += 1

    # Bulk insert for speed
    db.session.bulk_save_objects(rows)
    db.session.commit()

    url = str(db.engine.url)
    print(f"✅ Seeded {total} net-salary incomes into {url} across {len(months)} months.")


if __name__ == "__main__":
    from backend.app import create_app

    app = create_app()
    with app.app_context():
        main()
