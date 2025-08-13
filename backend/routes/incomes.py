from flask import Blueprint, jsonify, request

from models.models import Income, db

incomes_bp = Blueprint('incomes', __name__)

@incomes_bp.route('/api/incomes', methods=['GET', 'POST'])
def incomes_list_create():
    if request.method == 'GET':
        return jsonify([{
            'id': i.id,
            'month_id': i.month_id,
            'source': i.source,
            'amount': str(i.amount)
        } for i in Income.query.order_by(Income.id).all()])

    data = request.json
    i = Income(month_id=data['month_id'], source=data['source'], amount=data['amount'])
    db.session.add(i)
    db.session.commit()
    return jsonify({'id': i.id}), 201
