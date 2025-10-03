# backend/routes/months.py
from __future__ import annotations

from collections.abc import Iterable
from datetime import date
from decimal import Decimal
from typing import Any

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.orm import selectinload

from backend.models.models import Financing, Month, db

months_bp = Blueprint("months", __name__, url_prefix="/api/months")


# ---------- helpers ----------
def _month_label(m) -> str:
    d = getattr(m, "month_date", None)
    try:
        return d.strftime("%B %Y") if d else f"Month {getattr(m, 'id', '')}".strip()
    except Exception:
        return f"Month {getattr(m, 'id', '')}".strip()


def _f(v: Any, default: float = 0.0) -> float:
    if v is None or v == "":
        return float(default)
    if isinstance(v, float | int):
        return float(v)
    if isinstance(v, Decimal):
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
    if adj_type == "disbursement":
        return amount
    if adj_type == "payment":
        return -amount
    return 0.0


def _parse_anchor_ym(s: str | None) -> date | None:
    if not s:
        return None
    try:
        s = str(s).strip()
        return date(int(s[0:4]), int(s[5:7]), 1)
    except Exception:
        return None


def _same_month_ym(d: date | None, anchor: date | None) -> bool:
    if not d or not anchor:
        return False
    return (d.year, d.month) == (anchor.year, anchor.month)


# ---------- core ----------
def build_months_data(
    months: Iterable[Month],
    financing_data: dict[str, float],
    *,
    is_past: bool = False,
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    prev_ending_funds: float | None = None
    prev_loan_remaining: float | None = None
    dirty = False

    months_list = list(months)
    for idx, month in enumerate(months_list):
        incomes_list = [
            {
                "name": getattr(inc, "source", None),
                "person": getattr(inc, "person", None),
                "amount": _f(inc.amount),
            }
            for inc in (getattr(month, "incomes", []) or [])
        ]
        incomes_by_person: dict[str, float] = {}
        for item in incomes_list:
            key = item["person"] or "Unknown"
            incomes_by_person[key] = incomes_by_person.get(key, 0.0) + _f(
                item["amount"]
            )

        total_income = sum(x["amount"] for x in incomes_list)
        total_expenses = sum(
            _f(e.amount) for e in (getattr(month, "expenses", []) or [])
        )
        surplus = total_income - total_expenses

        if idx == 0:
            starting_funds = _f(month.starting_funds)
        else:
            starting_funds = (
                prev_ending_funds
                if prev_ending_funds is not None
                else _f(month.starting_funds)
            )

        if idx == 0:
            seed_loan = financing_data.get("loans_taken")
            loan_remaining = _f(seed_loan, _f(month.loan_remaining))
        else:
            loan_remaining = _f(prev_loan_remaining, _f(month.loan_remaining))

        loan_adj_sum = 0.0
        for adj in getattr(month, "loan_adjustments", []) or []:
            loan_adj_sum += _loan_delta(getattr(adj, "type", ""), _f(adj.amount))
        loan_remaining = _f(loan_remaining) + loan_adj_sum

        ending_funds = _f(starting_funds) + _f(surplus)

        if not is_past:
            updated = False
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
                "name": _month_label(month),
                "month_date": _iso(getattr(month, "month_date", None)),
                "startingFunds": _f(starting_funds),
                "endingFunds": _f(ending_funds),
                "surplus": _f(surplus),
                "loanRemaining": _f(loan_remaining),
                "is_current": bool(
                    getattr(month, "is_current", False)
                ),  # may be overridden
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
                        ).strip(),
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
                    for adj in (getattr(month, "loan_adjustments", []) or [])
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


# ---------- routes ----------
@months_bp.get("")
@months_bp.get("/")
def get_months():
    """
    Returns months from the chosen 'current' month (inclusive) onward.

    The anchor month comes from query param `anchor` (YYYY-MM or YYYY-MM-DD);
    if absent, we use today's month.
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

        # Build payload once
        payload = build_months_data(months, financing_data, is_past=False)

        # Compute anchor and slice index purely from DB dates (no flags/strings)
        anchor = _parse_anchor_ym(request.args.get("anchor")) or date.today().replace(
            day=1
        )
        anchor_ym = (anchor.year, anchor.month)

        idx = None
        for i, m in enumerate(months):
            d = getattr(m, "month_date", None)
            if d and (d.year, d.month) >= anchor_ym:
                idx = i
                break

        if idx is None:
            # Anchor after last month -> return empty list
            return jsonify([]), 200

        # Mark is_current on the chosen month in the payload
        chosen = months[idx]
        chosen_d = getattr(chosen, "month_date", None)
        for row in payload:
            # recompute using parsed date to avoid any string mismatch
            md = row.get("month_date")
            row_date = date(int(md[0:4]), int(md[5:7]), int(md[8:10])) if md else None
            row["is_current"] = _same_month_ym(row_date, chosen_d)

        return jsonify(payload[idx:]), 200

    except Exception as ex:
        current_app.logger.exception("/api/months failed, returning []: %s", ex)
        return jsonify([]), 200


@months_bp.get("/all")
def get_all_months():
    """Return all months (no mutations)."""
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
        return jsonify(build_months_data(months, financing_data, is_past=True)), 200
    except Exception as ex:
        current_app.logger.exception("/api/months/all failed, returning []: %s", ex)
        return jsonify([]), 200
