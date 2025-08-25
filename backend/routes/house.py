from flask import Blueprint, jsonify, request

from models.models import HouseCost, LandCost, db

house_bp = Blueprint('house', __name__)


@house_bp.route('/api/house_costs', methods=['GET', 'POST'])
def house_costs():
    if request.method == 'POST':
        data = request.get_json()
        new_cost = HouseCost(
            name=data['name'],
            amount=data['amount'],
            status=data.get('status', 'todo'),
        )
        db.session.add(new_cost)
        db.session.commit()
        return jsonify({'message': 'House cost added'}), 201

    costs = HouseCost.query.order_by(HouseCost.id).all()
    return jsonify(
        [
            {
                'id': c.id,
                'name': c.name,
                'amount': str(c.amount),
                'status': c.status,
            }
            for c in costs
        ]
    )


@house_bp.route('/api/land_costs', methods=['GET', 'POST'])
def land_costs():
    if request.method == 'POST':
        data = request.get_json()
        new_cost = LandCost(
            name=data['name'], amount=data['amount'], status=data.get('status', 'todo')
        )
        db.session.add(new_cost)
        db.session.commit()
        return jsonify({'message': 'Land cost added'}), 201

    land = LandCost.query.order_by(LandCost.id).all()
    return jsonify(
        [{'id': c.id, 'name': c.name, 'amount': str(c.amount), 'status': c.status} for c in land]
    )


@house_bp.route('/api/house_costs/<int:item_id>', methods=['DELETE'])
def delete_house_cost(item_id):
    cost = HouseCost.query.get_or_404(item_id)
    db.session.delete(cost)
    db.session.commit()
    return jsonify({'message': 'House cost deleted'})


@house_bp.route('/api/land_costs/<int:item_id>', methods=['DELETE'])
def delete_land_cost(item_id):
    cost = LandCost.query.get_or_404(item_id)
    db.session.delete(cost)
    db.session.commit()
    return jsonify({'message': 'Land cost deleted'})
