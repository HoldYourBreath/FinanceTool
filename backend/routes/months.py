# backend/routes/months.py
from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal
from typing import Any

from flask import Blueprint, current_app, jsonify
from sqlalchemy.orm import selectinload

from backend.models.models import Financing, Month, db


def _month_label(m) -> str:
    d = getattr(m, "month_date", None)
    try:
        # d can be a date/datetime; use full month name
        return d.strftime("%B %Y") if d else f"Month {getattr(m, 'id', '')}".strip()
    except Exception:
        return f"Month {getattr(m, 'id', '')}".strip()


# Final paths:
#   GET /api/months        -> months from the current month (inclusive) onward
#   GET /api/months/all    -> all months
months_bp = Blueprint("months", __name__, url_prefix="/api/months")


def _f(v: Any, default: float = 0.0) -> float:
    """
    Safe float coercion:
      - Decimal -> float
      - None / "" -> default
      - str with comma/space -> normalized float
      - any other -> float(value) or default on failure
    """
    if v is None or v == "":
        return float(default)
    if isinstance(v, float):
        return v
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, int):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace("\u00a0", "").replace(" ", "").replace(",", ".")
        try:
            return float(s)
        except Exception:
            return float(default)
    try:
        return float(v)
    except Exception:
        return float(default)


def _iso(d) -> str | None:
    return d.isoformat() if d is not None else None


def _loan_delta(adj_type: str, amount: float) -> float:
    # Positive for disbursement, negative for payment; ignore others
    if adj_type == "disbursement":
        return amount
    if adj_type == "payment":
        return -amount
    return 0.0


def build_months_data(
    months: Iterable[Month],
    financing_data: dict[str, float],
    *,
    is_past: bool = False,
) -> list[dict[str, Any]]:
    """
    Compute derived month fields. If is_past=False, update and persist
    Month.starting_funds, Month.ending_funds, Month.surplus, Month.loan_remaining
    when they differ (idempotent writes).

    Also returns richer income data:
      - incomes:        [{ name, person, amount }]
      - incomesByPerson: { personNameOrUnknown: totalAmount }
    """
    result: list[dict[str, Any]] = []
    prev_ending_funds: float | None = None
    prev_loan_remaining: float | None = None
    dirty = False

    months_list = list(months)
    for idx, month in enumerate(months_list):
        # ---- incomes & grouping ----
        incomes_list = [
            {
                "name": inc.source,
                "person": getattr(inc, "person", None),
                "amount": _f(inc.amount),
            }
            for inc in getattr(month, "incomes", []) or []
        ]
        incomes_by_person: dict[str, float] = {}
        for item in incomes_list:
            key = item["person"] or "Unknown"
            incomes_by_person[key] = incomes_by_person.get(key, 0.0) + _f(
                item["amount"]
            )

        total_income = sum(x["amount"] for x in incomes_list)
        total_expenses = sum(_f(e.amount) for e in getattr(month, "expenses", []) or [])
        surplus = total_income - total_expenses

        # ---- starting funds ----
        if idx == 0:
            starting_funds = _f(month.starting_funds)  # keep DB value for first row
        else:
            starting_funds = (
                prev_ending_funds
                if prev_ending_funds is not None
                else _f(month.starting_funds)
            )

        # ---- loan remaining (+ adjustments) ----
        if idx == 0:
            # seed from financing ("loans_taken") if present, fallback to month.loan_remaining
            seed_loan = financing_data.get("loans_taken")
            loan_remaining = _f(seed_loan, _f(month.loan_remaining))
        else:
            loan_remaining = _f(prev_loan_remaining, _f(month.loan_remaining))

        # Apply monthly loan adjustments
        loan_adj_sum = 0.0
        for adj in getattr(month, "loan_adjustments", []) or []:
            loan_adj_sum += _loan_delta(getattr(adj, "type", ""), _f(adj.amount))
        loan_remaining = _f(loan_remaining) + loan_adj_sum

        # ---- ending funds ----
        ending_funds = _f(starting_funds) + _f(surplus)

        # ---- persist if changed (only when is_past=False) ----
        if not is_past:
            updated = False

            # For idx == 0 we keep stored starting_funds; propagate for subsequent rows.
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

        # ---- build response row ----
        result.append(
            {
                "id": month.id,
                "name": _month_label(month),
                "month_date": _iso(getattr(month, "month_date", None)),
                "startingFunds": _f(starting_funds),
                "endingFunds": _f(ending_funds),
                "surplus": _f(surplus),
                "loanRemaining": _f(loan_remaining),
                "is_current": bool(getattr(month, "is_current", False)),
                "incomes": incomes_list,
                "incomesByPerson": incomes_by_person,
                "expenses": [
                    {
                        "id": e.id,
                        "name": (
                            getattr(e, "name", None)
                            or getattr(e, "description", "")
                            or ""
                        ).strip(),
                        "description": (
                            getattr(e, "name", None)
                            or getattr(e, "description", "")
                            or ""
                        ).strip(),  # temporary back-compat
                        "category": e.category or "Other",
                        "amount": _f(e.amount),
                    }
                    for e in (getattr(month, "expenses", []) or [])
                ],
                "loanAdjustments": [
                    {
                        "name": getattr(adj, "name", None),
                        "type": getattr(adj, "type", None),
                        "amount": _f(adj.amount),
                        "note": getattr(adj, "note", None),
                    }
                    for adj in getattr(month, "loan_adjustments", []) or []
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
        months = (
            db.session.query(Month)
            .options(
                selectinload(Month.incomes),
                selectinload(Month.expenses),
                selectinload(Month.loan_adjustments),
            )
            .order_by(Month.month_date.asc())
            .all()
        )
        financing_entries = db.session.query(Financing).all()
        financing_data = {f.name: _f(f.value) for f in financing_entries}

        all_months_data = build_months_data(months, financing_data, is_past=False)
        current_index = next(
            (i for i, m in enumerate(all_months_data) if m.get("is_current")), 0
        )
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
        months = (
            db.session.query(Month)
            .options(
                selectinload(Month.incomes),
                selectinload(Month.expenses),
                selectinload(Month.loan_adjustments),
            )
            .order_by(Month.month_date.asc())
            .all()
        )
        financing_entries = db.session.query(Financing).all()
        financing_data = {f.name: _f(f.value) for f in financing_entries}

        all_months_data = build_months_data(months, financing_data, is_past=True)
        return jsonify(all_months_data), 200
    except Exception as e:
        current_app.logger.warning("/api/months/all failed, returning []: %s", e)
        return jsonify([]), 200
