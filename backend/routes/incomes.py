# routes/incomes.py
from flask import Blueprint, current_app, jsonify, request

from backend.models.models import Income, db

incomes_bp = Blueprint("incomes", __name__, url_prefix="/api/incomes")

def _f(v, default=0.0):
    try: return float(v)
    except Exception: return float(default)

@incomes_bp.get("")
@incomes_bp.get("/")
def list_incomes():
    try:
        rows = Income.query.order_by(Income.id.asc()).all()
        data = []
        for r in rows:
            # person may not exist in demo DB → getattr with default
            person = getattr(r, "person", None)
            data.append({
                "id": r.id,
                "month_id": r.month_id,
                "source": r.source,
                "person": person,               # <-- expose it (can be None)
                "amount": _f(r.amount),
            })
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.warning("GET /api/incomes failed; returning []: %s", e)
        return jsonify([]), 200

@incomes_bp.post("")
@incomes_bp.post("/")
def create_income():
    data = request.get_json(silent=True) or {}
    month_id = data.get("month_id")
    source = (data.get("source") or "").strip()
    person = (data.get("person") or "").strip() or None   # <-- accept person in payload
    amount = _f(data.get("amount"), 0.0)

    if month_id is None: return jsonify({"error":"month_id is required"}), 400
    if not source:       return jsonify({"error":"source is required"}), 400

    try:
        r = Income(month_id=month_id, source=source, amount=amount)
        # attach person if the column exists in this DB
        if hasattr(r, "person"):
            r.person = person
        db.session.add(r)
        db.session.commit()
        return jsonify({"id": r.id}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("POST /api/incomes failed: %s", e)
        return jsonify({"error": "Internal Server Error"}), 500
