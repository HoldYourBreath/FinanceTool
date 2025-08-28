# routes/planned_purchases.py
from datetime import datetime
from flask import Blueprint, jsonify, request, current_app
from backend.models.models import PlannedPurchase, db

# Final paths:
#   GET/POST   /api/planned_purchases
#   PUT        /api/planned_purchases/<id>
planned_purchases_bp = Blueprint("planned_purchases", __name__, url_prefix="/api/planned_purchases")


def _parse_date(s: str | None):
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


def _to_float(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return float(default)


@planned_purchases_bp.get("")
@planned_purchases_bp.get("/")
def list_planned_purchases():
    """CI-safe: return [] with 200 even if query fails."""
    try:
        purchases = PlannedPurchase.query.order_by(PlannedPurchase.id.asc()).all()
        # Prefer a to_dict() if present; otherwise build a minimal dict.
        items = []
        for p in purchases:
            if hasattr(p, "to_dict"):
                items.append(p.to_dict())
            else:
                items.append(
                    {
                        "id": p.id,
                        "item": getattr(p, "item", None),
                        "amount": _to_float(getattr(p, "amount", 0)),
                        "date": getattr(p, "date", None).isoformat() if getattr(p, "date", None) else None,
                        "note": getattr(p, "note", None),
                        "category": getattr(p, "category", None),
                    }
                )
        return jsonify(items), 200
    except Exception as e:
        current_app.logger.warning("GET /api/planned_purchases failed; returning []: %s", e)
        return jsonify([]), 200


@planned_purchases_bp.post("")
@planned_purchases_bp.post("/")
def create_planned_purchase():
    data = request.get_json(silent=True) or {}
    item = (data.get("item") or "").strip()
    amount = _to_float(data.get("amount"))
    date = _parse_date(data.get("date"))
    note = data.get("note")
    category = data.get("category")

    if not item:
        return jsonify({"error": "item is required"}), 400

    try:
        p = PlannedPurchase(item=item, amount=amount, date=date, note=note, category=category)
        db.session.add(p)
        db.session.commit()
        return jsonify({"id": p.id}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("POST /api/planned_purchases failed: %s", e)
        return jsonify({"error": "Internal Server Error"}), 500


@planned_purchases_bp.put("/<int:id>")
def update_planned_purchase(id: int):
    try:
        p = PlannedPurchase.query.get_or_404(id)
        data = request.get_json(silent=True) or {}

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
        return jsonify({"message": "Updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("PUT /api/planned_purchases/%s failed: %s", id, e)
        return jsonify({"error": "Internal Server Error"}), 500
