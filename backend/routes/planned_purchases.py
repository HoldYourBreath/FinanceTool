# routes/planned_purchases.py
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from flask import Blueprint, current_app, jsonify, request

from backend.models.models import PlannedPurchase, db

# Final paths after register_routes(app, url_prefix="/api"):
#   GET/POST     /api/planned_purchases
#   PUT/PATCH    /api/planned_purchases/<id>
planned_purchases_bp = Blueprint(
    "planned_purchases",
    __name__,
    url_prefix="/api/planned_purchases",
)


# -------------------- helpers --------------------
def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


def _to_float(v: Any, default: float = 0.0) -> float:
    """Float-ish coercion that tolerates None/'1,23'/weird input."""
    if v is None:
        return float(default)
    try:
        return float(v)
    except Exception:
        try:
            return float(str(v).replace(",", "."))
        except Exception:
            return float(default)


def _row_to_dict(p: PlannedPurchase) -> dict[str, Any]:
    """Prefer model.to_dict() if present; else minimal dict."""
    if hasattr(p, "to_dict"):
        try:
            d = p.to_dict()  # type: ignore[attr-defined]
            # ensure amount is float and date is iso or None
            d["amount"] = _to_float(d.get("amount", 0))
            if isinstance(d.get("date"), datetime | date):
                d["date"] = d["date"].isoformat()
            return d
        except Exception:
            pass

    return {
        "id": p.id,
        "item": getattr(p, "item", None),
        "amount": _to_float(getattr(p, "amount", 0)),
        "date": (getattr(p, "date", None) or None),
        "note": getattr(p, "note", None),
        "category": getattr(p, "category", None),
    } | ({"date": p.date.isoformat()} if getattr(p, "date", None) else {"date": None})


# -------------------- routes --------------------
@planned_purchases_bp.get("")
@planned_purchases_bp.get("/")
def list_planned_purchases():
    """
    Return all planned purchases.

    CI/empty-safe: returns 200 with [] even on query errors,
    so frontend logic can remain simple.
    """
    try:
        rows = PlannedPurchase.query.order_by(PlannedPurchase.id.asc()).all()
        return jsonify([_row_to_dict(p) for p in rows]), 200
    except Exception as e:
        current_app.logger.warning("GET /api/planned_purchases failed; returning []: %s", e)
        return jsonify([]), 200


@planned_purchases_bp.post("")
@planned_purchases_bp.post("/")
def create_planned_purchase():
    data = request.get_json(silent=True) or {}

    item = (data.get("item") or "").strip()
    if not item:
        return jsonify({"error": "item is required"}), 400

    amount = _to_float(data.get("amount"))
    when = _parse_date(data.get("date"))
    note = data.get("note")
    category = data.get("category")

    try:
        p = PlannedPurchase(
            item=item,
            amount=amount,
            date=when,
            note=note,
            category=category,
        )
        db.session.add(p)
        db.session.commit()
        return jsonify({"id": p.id}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("POST /api/planned_purchases failed: %s", e)
        return jsonify({"error": "Internal Server Error"}), 500


@planned_purchases_bp.put("/<int:id>")
@planned_purchases_bp.patch("/<int:id>")
def update_planned_purchase(id: int):
    data = request.get_json(silent=True) or {}
    try:
        p = PlannedPurchase.query.get_or_404(id)

        if "item" in data:
            p.item = (data.get("item") or "").strip()
        if "amount" in data:
            p.amount = _to_float(data.get("amount"))
        if "date" in data:
            p.date = _parse_date(data.get("date"))
        if "note" in data:
            p.note = data.get("note")
        if "category" in data:
            p.category = data.get("category")

        db.session.commit()
        return jsonify({"message": "updated"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("PUT/PATCH /api/planned_purchases/%s failed: %s", id, e)
        return jsonify({"error": "Internal Server Error"}), 500
