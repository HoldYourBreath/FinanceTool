# backend/cli/seed_incomes.py
from __future__ import annotations

import argparse
import random
from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import and_, delete, select

from backend.models.models import Income, IncomeSource, Month, db


def _with_jitter(amount: float, pct: float) -> float:
    return round(float(amount) * (1.0 + pct * (random.random() * 2 - 1)), 2)


def _iter_months(
    all_months: list[Month], from_ym: str | None, to_ym: str | None
) -> Iterable[Month]:
    def ym(m: Month) -> str:
        # expects Month.month_date to be a date/datetime at first day of month
        return m.month_date.strftime("%Y-%m")

    for m in all_months:
        yymm = ym(m)
        if from_ym and yymm < from_ym:
            continue
        if to_ym and yymm > to_ym:
            continue
        yield m


def seed_incomes(
    mode: str,
    from_ym: str | None,
    to_ym: str | None,
    stable_seed: int | None,
    use_jitter: bool = True,
) -> None:
    """
    mode:
      - fill-missing : only create Income if (month_id, source) does not exist
      - regenerate   : delete then recreate for selected months
    range: [from_ym, to_ym] where ym is 'YYYY-MM' (inclusive). Omit to use all months.
    stable_seed: if provided, makes jitter deterministic across months (good for tests/consistency).
    """

    # Load months and active income sources
    months = Month.query.order_by(Month.month_date.asc()).all()
    if not months:
        print("⚠️  No months found; nothing to do.")
        return

    sources = (
        IncomeSource.query.filter_by(is_active=True)
        .order_by(IncomeSource.id.asc())
        .all()
    )
    if not sources:
        print("⚠️  No active income_sources; nothing to do.")
        return

    target_months = list(_iter_months(months, from_ym, to_ym))
    if not target_months:
        print("⚠️  No months in selected range; nothing to do.")
        return

    now = datetime.now(UTC)

    if mode == "regenerate":
        # Delete only incomes that match the target months and source labels (safe, scoped)
        month_ids = [m.id for m in target_months]
        source_labels = [s.label for s in sources]

        db.session.execute(
            delete(Income).where(
                and_(
                    Income.month_id.in_(month_ids),
                    Income.source.in_(source_labels),
                )
            )
        )
        db.session.flush()

    created = 0
    skipped = 0

    for i, m in enumerate(target_months):
        # Deterministic but month-varying seed if provided
        if stable_seed is not None:
            random.seed(stable_seed + i)

        # Fetch existing income (month,source) pairs to avoid duplicates on fill-missing
        existing_pairs = set(
            db.session.execute(select(Income.source).where(Income.month_id == m.id))
            .scalars()
            .all()
        )

        for s in sources:
            if mode == "fill-missing" and s.label in existing_pairs:
                skipped += 1
                continue

            base = float(s.base_amount or 0.0)
            amt = (
                _with_jitter(base, float(s.jitter_pct or 0.0))
                if (use_jitter and s.jitter_pct)
                else round(base, 2)
            )

            row = Income(month_id=m.id, source=s.label, amount=amt, created_at=now)
            if hasattr(Income, "person"):
                row.person = s.person
            if hasattr(Income, "name"):
                row.name = s.label

            db.session.add(row)
            created += 1

    db.session.commit()
    print(
        f"✅ Done. Created {created} incomes. Skipped {skipped}. Months affected: {len(target_months)}. Sources: {len(sources)}."
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed monthly incomes from income_sources (generic, env-agnostic)."
    )
    parser.add_argument(
        "--mode",
        choices=["fill-missing", "regenerate"],
        default="fill-missing",
        help="fill-missing: only create absent rows; regenerate: delete+recreate for range.",
    )
    parser.add_argument(
        "--from",
        dest="from_ym",
        help="Start month inclusive, format YYYY-MM (e.g., 2025-01).",
    )
    parser.add_argument(
        "--to",
        dest="to_ym",
        help="End month inclusive, format YYYY-MM (e.g., 2025-12).",
    )
    parser.add_argument(
        "--stable-seed",
        type=int,
        default=None,
        help="Deterministic jitter base seed for reproducibility.",
    )
    parser.add_argument(
        "--no-jitter",
        action="store_true",
        help="Disable random jitter; use exact base amounts.",
    )
    args = parser.parse_args()

    # Lazy import to ensure app context
    from backend.app import create_app

    app = create_app()
    with app.app_context():
        seed_incomes(
            mode=args.mode,
            from_ym=args.from_ym,
            to_ym=args.to_ym,
            stable_seed=args.stable_seed,
            use_jitter=not args.no_jitter,
        )


if __name__ == "__main__":
    main()
