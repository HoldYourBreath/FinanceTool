# routes/house_costs.py
from flask import Blueprint, current_app, jsonify, request

from backend.models.models import HouseCost, LandCost, db

house_bp = Blueprint("house", __name__, url_prefix="/api")


def _f(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return float(default)


# ---------- HOUSE COSTS ----------


@house_bp.get("/house_costs")
@house_bp.get("/house_costs/")
def list_house_costs():
    """CI-safe: return [] with 200 even if query fails."""
    try:
        rows = HouseCost.query.order_by(HouseCost.id.asc()).all()
        data = [
            {"id": r.id, "name": r.name, "amount": _f(r.amount), "status": r.status} for r in rows
        ]
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.warning("GET /api/house_costs failed; returning []: %s", e)
        return jsonify([]), 200


@house_bp.post("/house_costs")
@house_bp.post("/house_costs/")
def create_house_cost():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    amount = _f(data.get("amount"), 0.0)
    status = (data.get("status") or "todo").strip() or "todo"

    if not name:
        return jsonify({"error": "name is required"}), 400

    try:
        r = HouseCost(name=name, amount=amount, status=status)
        db.session.add(r)
        db.session.commit()
        return jsonify({"id": r.id}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("POST /api/house_costs failed: %s", e)
        return jsonify({"error": "Internal Server Error"}), 500


@house_bp.delete("/house_costs/<int:item_id>")
def delete_house_cost(item_id: int):
    try:
        r = HouseCost.query.get_or_404(item_id)
        db.session.delete(r)
        db.session.commit()
        return jsonify({"message": "House cost deleted"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("DELETE /api/house_costs/%s failed: %s", item_id, e)
        return jsonify({"error": "Internal Server Error"}), 500


# ---------- LAND COSTS ----------


@house_bp.get("/land_costs")
@house_bp.get("/land_costs/")
def list_land_costs():
    """CI-safe: return [] with 200 on error."""
    try:
        rows = LandCost.query.order_by(LandCost.id.asc()).all()
        data = [
            {"id": r.id, "name": r.name, "amount": _f(r.amount), "status": r.status} for r in rows
        ]
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.warning("GET /api/land_costs failed; returning []: %s", e)
        return jsonify([]), 200


@house_bp.post("/land_costs")
@house_bp.post("/land_costs/")
def create_land_cost():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    amount = _f(data.get("amount"), 0.0)
    status = (data.get("status") or "todo").strip() or "todo"

    if not name:
        return jsonify({"error": "name is required"}), 400

    try:
        r = LandCost(name=name, amount=amount, status=status)
        db.session.add(r)
        db.session.commit()
        return jsonify({"id": r.id}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("POST /api/land_costs failed: %s", e)
        return jsonify({"error": "Internal Server Error"}), 500


@house_bp.delete("/land_costs/<int:item_id>")
def delete_land_cost(item_id: int):
    try:
        r = LandCost.query.get_or_404(item_id)
        db.session.delete(r)
        db.session.commit()
        return jsonify({"message": "Land cost deleted"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("DELETE /api/land_costs/%s failed: %s", item_id, e)
        return jsonify({"error": "Internal Server Error"}), 500
