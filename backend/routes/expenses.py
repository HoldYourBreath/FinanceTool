# routes/expenses.py
from flask import Blueprint, current_app, jsonify, request

from ..models.models import Expense, db

expenses_bp = Blueprint("expenses", __name__, url_prefix="/api/expenses")


def _f(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return float(default)


@expenses_bp.get("")
@expenses_bp.get("/")
def list_expenses():
    """Return expenses (optionally filtered by month_id). CI-safe: [] on error."""
    try:
        q = Expense.query
        month_id = request.args.get("month_id", type=int)
        if month_id:
            q = q.filter(Expense.month_id == month_id)

        rows = q.order_by(Expense.category.asc(), Expense.id.asc()).all()
        data = [
            {
                "id": e.id,
                "month_id": e.month_id,
                "category": e.category or "Other",
                "name": e.name,
                "description": e.name,  # temporary alias for any old clients
                "amount": _f(e.amount),
                "created_at": (
                    e.created_at.isoformat() if getattr(e, "created_at", None) else None
                ),
            }
            for e in rows
        ]
        return jsonify(data), 200
    except Exception as ex:
        current_app.logger.warning("GET /api/expenses failed; returning []: %s", ex)
        return jsonify([]), 200


@expenses_bp.post("")
@expenses_bp.post("/")
def create_expense():
    """Create a new expense. Accepts 'name' or 'description' for the item label."""
    data = request.get_json(silent=True) or {}

    month_id = data.get("month_id")
    category = (data.get("category") or "").strip()
    # accept either 'name' or 'description'
    name = (data.get("name") or data.get("description") or "").strip()
    amount = _f(data.get("amount"), 0.0)

    if month_id is None:
        return jsonify({"error": "month_id is required"}), 400
    if not category:
        return jsonify({"error": "category is required"}), 400
    if not name:
        return jsonify({"error": "name is required"}), 400

    try:
        e = Expense(
            month_id=month_id,
            category=category,
            name=name,
            amount=amount,
        )
        db.session.add(e)
        db.session.commit()
        return jsonify({"id": e.id}), 201
    except Exception as ex:
        db.session.rollback()
        current_app.logger.exception("POST /api/expenses failed: %s", ex)
        return jsonify({"error": "Internal Server Error"}), 500
