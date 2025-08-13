# routes/settings.py
import json
import os

from flask import Blueprint, jsonify, request

from models.models import AccInfo, Month, PriceSettings, db

settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')

ACCOUNTS_JSON_FILE = 'data/accounts.json'

def get_or_create_prices():
    row = PriceSettings.query.get(1)
    if not row:
        row = PriceSettings(id=1)
        db.session.add(row)
        db.session.commit()
    return row

# ---- Accounts ----
@settings_bp.route('/accounts', methods=['POST'])
def update_accounts():
    data = request.json
    if not isinstance(data, list):
        return jsonify({'error': 'Expected a list of accounts'}), 400

    AccInfo.query.delete()
    for item in data:
        account = AccInfo(
            person=item.get('person', ''),
            bank=item.get('bank', ''),
            acc_number=item.get('acc_number', ''),
            country=item.get('country', ''),
            value=float(item.get('value', 0) or 0)
        )
        db.session.add(account)
    db.session.commit()

    os.makedirs(os.path.dirname(ACCOUNTS_JSON_FILE), exist_ok=True)
    with open(ACCOUNTS_JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

    return jsonify({'message': 'Accounts updated in DB and JSON file'})

# ---- Current month ----
@settings_bp.route('/current_month', methods=['POST'])
def set_current_month():
    try:
        data = request.get_json() or {}
        month_id = data.get('month_id')
        if not month_id:
            return jsonify({'error': 'No month_id provided'}), 400

        # Ensure int (select sends string)
        try:
            month_id = int(month_id)
        except ValueError:
            return jsonify({'error': 'month_id must be an integer'}), 400

        # Unset all, then set selected
        Month.query.update({Month.is_current: False})
        db.session.flush()

        selected_month = Month.query.get(month_id)
        if not selected_month:
            return jsonify({'error': 'Month not found'}), 404

        selected_month.is_current = True
        db.session.commit()
        return jsonify({'message': 'Current month updated successfully'}), 200

    except Exception as e:
        print(f"❌ Error updating current month: {e}")
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500

# ---- Prices ----
@settings_bp.route('/prices', methods=['GET'])
def get_prices():
    row = get_or_create_prices()
    return jsonify({
        'el_price_ore_kwh': row.el_price_ore_kwh,
        'diesel_price_sek_litre': row.diesel_price_sek_litre,
        'bensin_price_sek_litre': row.bensin_price_sek_litre,
        'yearly_km': row.yearly_km,
    })

@settings_bp.route('/prices', methods=['POST'])
def save_prices():
    data = request.get_json() or {}
    row = get_or_create_prices()
    try:
        if 'el_price_ore_kwh' in data:
            row.el_price_ore_kwh = int(data['el_price_ore_kwh'])
        if 'diesel_price_sek_litre' in data:
            row.diesel_price_sek_litre = float(data['diesel_price_sek_litre'])
        if 'bensin_price_sek_litre' in data:
            row.bensin_price_sek_litre = float(data['bensin_price_sek_litre'])
        if 'yearly_km' in data:
            row.yearly_km = int(data['yearly_km'])
        db.session.commit()
        return jsonify({'message': 'Settings saved'}), 200
    except Exception as e:
        db.session.rollback()
        print('❌ save_prices error:', e)
        return jsonify({'error': 'Internal server error'}), 500
