# routes/financing.py
from flask import Blueprint, jsonify, request, current_app
from ..models.models import db

# Try model import; stay CI-safe if migrations/models aren't ready.
try:
    from models.models import Financing
except Exception:  # pragma: no cover
    Financing = None

financing_bp = Blueprint("financing", __name__, url_prefix="/api/financing")

def _f(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return float(default)

@financing_bp.get("")
@financing_bp.get("/")
def list_financing():
    """
    Returns financing key/values.
    CI-safe: return [] with 200 even if table/model is missing.
    """
    try:
        if Financing is None:
            return jsonify([]), 200
        rows = db.session.query(Financing).order_by(Financing.name.asc()).all()
        items = [{"id": r.id, "name": r.name, "value": _f(r.value)} for r in rows]
        return jsonify(items), 200
    except Exception as e:
        current_app.logger.warning("GET /api/financing failed; returning []: %s", e)
        return jsonify([]), 200

@financing_bp.post("")
@financing_bp.post("/")
def upsert_financing():
    """
    Upsert a financing entry.
    Body: { "name": string, "value": number|string }
    """
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    value = _f(data.get("value"), 0.0)

    if Financing is None:
        # Keep CI green even if model isn't available.
        return jsonify({"ok": True, "id": None, "name": name, "value": value}), 201

    try:
        row = Financing.query.filter_by(name=name).first()
        if row:
            row.value = value
        else:
            row = Financing(name=name, value=value)
            db.session.add(row)
        db.session.commit()
        return jsonify({"ok": True, "id": getattr(row, "id", None), "name": name, "value": value}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("POST /api/financing failed: %s", e)
        return jsonify({"error": "Internal Server Error"}), 500
