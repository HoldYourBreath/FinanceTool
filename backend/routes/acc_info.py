from flask import Blueprint, jsonify, request

from models.models import AccInfo, db

acc_info_bp = Blueprint('acc_info', __name__)

@acc_info_bp.route('/api/acc_info', methods=['GET'])
def get_acc_info():
    acc_info_items = AccInfo.query.order_by(AccInfo.id).all()
    return jsonify([
        {
            'id': m.id,
            'person': m.person,
            'bank': m.bank,
            'acc_number': m.acc_number,
            'country': m.country,
            'value': str(m.value)
        } for m in acc_info_items
    ])

@acc_info_bp.route('/api/acc_info/bulk', methods=['POST'])
def bulk_insert_acc_info():
    try:
        data = request.json
        if not isinstance(data, list):
            return jsonify({'error': 'Expected a list of entries'}), 400

        inserted = []
        for item in data:
            exists = AccInfo.query.filter_by(
                person=item['person'],
                bank=item['bank'],
                acc_number=item['acc_number'],
                country=item['country']
            ).first()

            if not exists:
                new_entry = AccInfo(
                    person=item['person'],
                    bank=item['bank'],
                    acc_number=item['acc_number'],
                    country=item['country'],
                    value=item.get('value', 0)
                )
                db.session.add(new_entry)
                inserted.append(item)

        db.session.commit()
        return jsonify({'inserted': len(inserted), 'details': inserted}), 201

    except Exception as e:
        print(f"❌ Error during bulk insert: {e}")
        return jsonify({'error': 'Internal server error'}), 500
