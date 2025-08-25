from flask import Blueprint, jsonify

from models.models import Investment

investments_bp = Blueprint('investments', __name__)


@investments_bp.route('/api/investments', methods=['GET'])
def get_investments():
    data = Investment.query.all()
    return jsonify(
        [{'name': inv.name, 'value': inv.value, 'paid': inv.paid, 'rent': inv.rent} for inv in data]
    )
