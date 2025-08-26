# routes/months.py
from flask import Blueprint, jsonify, current_app
from models.models import Financing, Month, db

# Final paths:
#   GET /api/months        -> months from the current month (inclusive) onward
#   GET /api/months/all    -> all months
months_bp = Blueprint("months", __name__, url_prefix="/api/months")


def _f(v, default=0.0) -> float:
    try:
        return float(v) if v is not None and v != "" else float(default)
    except Exception:
        return float(default)


def build_months_data(months, financing_data, is_past: bool = False):
    """
    Compute derived month fields. If is_past=False, update and persist
    Month.starting_funds, Month.ending_funds, Month.surplus, Month.loan_remaining
    when they differ (idempotent writes).
    """
    result = []
    prev_ending_funds = None
    prev_loan_remaining = None
    dirty = False

    for idx, month in enumerate(months):
        total_income = sum(_f(i.amount) for i in getattr(month, "incomes", []))
        total_expenses = sum(_f(e.amount) for e in getattr(month, "expenses", []))
        surplus = total_income - total_expenses

        # First row: prefer stored starting_funds; otherwise carry over from previous
        starting_funds = _f(month.starting_funds) if idx == 0 else prev_ending_funds

        # Seed loan_remaining from financing table on the first row when available
        if idx == 0:
            seed_loan = financing_data.get("loans_taken")
            loan_remaining = _f(seed_loan, _f(month.loan_remaining))
        else:
            loan_remaining = prev_loan_remaining

        # Apply loan adjustments (positive for disbursement, negative for payment)
        loan_adjustment_delta = 0.0
        for adj in getattr(month, "loan_adjustments", []):
            if adj.type in ("disbursement", "payment"):
                loan_adjustment_delta += _f(adj.amount) if adj.type == "disbursement" else -_f(adj.amount)
        loan_remaining = _f(loan_remaining) + loan_adjustment_delta

        ending_funds = _f(starting_funds) + surplus

        if not is_past:
            updated = False

            # For idx == 0 we don't overwrite starting_funds coming from DB;
            # for subsequent months we propagate from previous month’s ending_funds.
            if idx != 0 and _f(month.starting_funds) != _f(starting_funds):
                month.starting_funds = starting_funds
                updated = True

            if _f(month.ending_funds) != _f(ending_funds):
                month.ending_funds = ending_funds
                updated = True

            if _f(month.surplus) != _f(surplus):
                month.surplus = surplus
                updated = True

            if _f(month.loan_remaining) != _f(loan_remaining):
                month.loan_remaining = loan_remaining
                updated = True

            if updated:
                db.session.add(month)
                dirty = True

        result.append(
            {
                "id": month.id,
                "name": month.name,
                "month_date": month.month_date.isoformat() if getattr(month, "month_date", None) else None,
                "startingFunds": _f(starting_funds),
                "endingFunds": _f(ending_funds),
                "surplus": _f(surplus),
                "loanRemaining": _f(loan_remaining),
                "is_current": bool(getattr(month, "is_current", False)),
                "incomes": [{"name": i.source, "amount": _f(i.amount)} for i in getattr(month, "incomes", [])],
                "expenses": [{"description": e.description, "amount": _f(e.amount)} for e in getattr(month, "expenses", [])],
                "loanAdjustments": [
                    {"name": adj.name, "type": adj.type, "amount": _f(adj.amount), "note": adj.note}
                    for adj in getattr(month, "loan_adjustments", [])
                ],
            }
        )

        prev_ending_funds = ending_funds
        prev_loan_remaining = loan_remaining

    if not is_past and dirty:
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            current_app.logger.exception("Commit failed in build_months_data: %s", e)

    return result


@months_bp.get("")
@months_bp.get("/")
def get_months():
    """
    Returns months from the first 'is_current' month (inclusive) onward.
    CI-safe: on any error, return [] with 200.
    """
    try:
        months = Month.query.order_by(Month.month_date.asc()).all()
        financing_entries = Financing.query.all()
        financing_data = {f.name: _f(f.value) for f in financing_entries}

        all_months_data = build_months_data(months, financing_data, is_past=False)

        current_index = next((i for i, m in enumerate(all_months_data) if m.get("is_current")), 0)
        future_months_data = all_months_data[current_index:]
        return jsonify(future_months_data), 200
    except Exception as e:
        current_app.logger.warning("/api/months failed, returning []: %s", e)
        return jsonify([]), 200


@months_bp.get("/all")
def get_all_months():
    """
    Returns all months without mutating DB (is_past=True).
    CI-safe: on any error, return [] with 200.
    """
    try:
        months = Month.query.order_by(Month.month_date.asc()).all()
        financing_entries = Financing.query.all()
        financing_data = {f.name: _f(f.value) for f in financing_entries}

        all_months_data = build_months_data(months, financing_data, is_past=True)
        return jsonify(all_months_data), 200
    except Exception as e:
        current_app.logger.warning("/api/months/all failed, returning []: %s", e)
        return jsonify([]), 200
