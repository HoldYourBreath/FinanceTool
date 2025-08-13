from flask import Blueprint, request, jsonify
from models.models import LoanAdjustment, db

loans_bp = Blueprint('loans', __name__)

@loans_bp.route('/api/loan_adjustments', methods=['GET', 'POST'])
def loans_list_create():
    if request.method == 'GET':
        return jsonify([{
            'id': l.id,
            'month_id': l.month_id,
            'type': l.type,
            'amount': str(l.amount),
            'note': l.note
        } for l in LoanAdjustment.query.order_by(LoanAdjustment.id).all()])
    
    data = request.json
    l = LoanAdjustment(month_id=data['month_id'], type=data['type'], amount=data['amount'], note=data.get('note'))
    db.session.add(l)
    db.session.commit()
    return jsonify({'id': l.id}), 201
