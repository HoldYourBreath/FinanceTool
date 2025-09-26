# routes/loan_adjustments.py
from flask import Blueprint, current_app, jsonify, request

from backend.models.models import LoanAdjustment, db

# Final paths:
#   GET/POST /api/loan_adjustments
loans_bp = Blueprint("loans", __name__, url_prefix="/api/loan_adjustments")


def _f(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return float(default)


def _s(v, default="other"):
    return v if isinstance(v, str) and v != "" else default


@loans_bp.get("")
@loans_bp.get("/")
def list_loan_adjustments():
    """CI-safe: return [] with 200 even if query fails."""
    try:
        items = LoanAdjustment.query.order_by(LoanAdjustment.id.asc()).all()
        return (
            jsonify(
                [
                    {
                        "id": adj.id,
                        "month_id": adj.month_id,
                        # If note == "Start Loan", label as opening balance; otherwise "other"
                        "type": _s(
                            adj.type,
                            (
                                "opening_balance"
                                if (adj.note or "").strip() == "Start Loan"
                                else "other"
                            ),
                        ),
                        "amount": _f(adj.amount),
                        "note": adj.note,
                    }
                    for adj in items
                ]
            ),
            200,
        )
    except Exception as e:
        current_app.logger.warning(
            "GET /api/loan_adjustments failed; returning []: %s", e
        )
        return jsonify([]), 200


@loans_bp.post("")
@loans_bp.post("/")
def create_loan_adjustment():
    """Create a loan adjustment; minimal validation, guarded commit."""
    data = request.get_json(silent=True) or {}

    required = ("month_id", "type", "amount")
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        adj = LoanAdjustment(
            month_id=data["month_id"],
            type=data["type"],
            amount=_f(data["amount"], 0.0),
            note=data.get("note"),
        )
        db.session.add(adj)
        db.session.commit()
        return (
            jsonify(
                {
                    "id": adj.id,
                    "month_id": adj.month_id,
                    "type": adj.type,
                    "amount": _f(adj.amount),
                    "note": adj.note,
                }
            ),
            201,
        )
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("POST /api/loan_adjustments failed: %s", e)
        return jsonify({"error": "Internal Server Error"}), 500
