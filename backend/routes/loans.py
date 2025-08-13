from flask import Blueprint, jsonify, request

from models.models import LoanAdjustment, db

loans_bp = Blueprint('loans', __name__)

@loans_bp.route('/api/loan_adjustments', methods=['GET', 'POST'])
def loans_list_create():
    if request.method == 'GET':
        items = LoanAdjustment.query.order_by(LoanAdjustment.id.asc()).all()
        return jsonify([{
            "id": adj.id,
            "month_id": adj.month_id,
            "type": adj.type,
            "amount": str(adj.amount),  # keep as string if Decimal
            "note": adj.note,
        } for adj in items])

    # POST
    data = request.get_json(silent=True) or {}
    required = ("month_id", "type", "amount")
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    adj = LoanAdjustment(
        month_id=data["month_id"],
        type=data["type"],
        amount=data["amount"],      # let your model/DB handle Decimal/Float
        note=data.get("note"),
    )
    db.session.add(adj)
    db.session.commit()

    return jsonify({
        "id": adj.id,
        "month_id": adj.month_id,
        "type": adj.type,
        "amount": str(adj.amount),
        "note": adj.note,
    }), 201
