from flask import Blueprint, jsonify

from models.models import Financing

financing_bp = Blueprint('financing', __name__)

@financing_bp.route('/api/financing', methods=['GET'])
def get_financing():
    financing_items = Financing.query.order_by(Financing.id).all()
    return jsonify([
        {
            'id': f.id,
            'name': f.name,
            'value': float(f.value)
        } for f in financing_items
    ])
