from datetime import datetime

from flask import Blueprint, jsonify, request

from models.models import PlannedPurchase, db

planned_purchases_bp = Blueprint('planned_purchases', __name__)


@planned_purchases_bp.route('/api/planned_purchases', methods=['GET', 'POST'])
def handle_planned_purchases():
    if request.method == 'GET':
        try:
            purchases = PlannedPurchase.query.order_by(PlannedPurchase.id).all()
            return jsonify([p.to_dict() for p in purchases])
        except Exception as e:
            print(f'❌ Error fetching planned purchases: {e}')
            return jsonify({'error': 'Internal Server Error'}), 500

    # POST
    try:
        data = request.json
        new_purchase = PlannedPurchase(
            item=data['item'],
            amount=data['amount'],
            date=datetime.strptime(data['date'], '%Y-%m-%d').date() if data.get('date') else None,
        )
        db.session.add(new_purchase)
        db.session.commit()
        return jsonify({'id': new_purchase.id}), 201
    except Exception as e:
        print(f'❌ Error creating planned purchase: {e}')
        return jsonify({'error': 'Internal Server Error'}), 500


@planned_purchases_bp.route('/api/planned_purchases/<int:id>', methods=['PUT'])
def update_planned_purchase(id):
    try:
        purchase = PlannedPurchase.query.get_or_404(id)
        data = request.json

        if 'item' in data:
            purchase.item = data['item']
        if 'amount' in data:
            purchase.amount = data['amount']
        if 'date' in data:
            purchase.date = (
                datetime.strptime(data['date'], '%Y-%m-%d').date() if data['date'] else None
            )

        db.session.commit()
        return jsonify({'message': 'Updated successfully'})
    except Exception as e:
        print(f'❌ Error updating planned purchase: {e}')
        return jsonify({'error': 'Internal Server Error'}), 500
