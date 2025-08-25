from flask import Blueprint, jsonify, request

from models.models import Expense, db

expenses_bp = Blueprint('expenses', __name__)


@expenses_bp.route('/api/expenses', methods=['GET', 'POST'])
def expenses_list_create():
    if request.method == 'GET':
        return jsonify(
            [
                {
                    'id': e.id,
                    'month_id': e.month_id,
                    'category': e.category,
                    'description': e.description,
                    'amount': str(e.amount),
                }
                for e in Expense.query.order_by(Expense.id).all()
            ]
        )

    data = request.json
    e = Expense(
        month_id=data['month_id'],
        category=data['category'],
        description=data['description'],
        amount=data['amount'],
    )
    db.session.add(e)
    db.session.commit()
    return jsonify({'id': e.id}), 201
