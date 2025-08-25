import os

import pandas as pd
from flask import Blueprint, jsonify, request

from models.models import AccInfo, Month, db

# 👇 add /api in the blueprint prefix so the final path is /api/upload/csv
file_upload_bp = Blueprint('file_upload', __name__, url_prefix='/api/upload')

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@file_upload_bp.route('/csv', methods=['POST'])
def upload_csv():
    # --- file presence/validation ---
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if not (file and allowed_file(file.filename)):
        return jsonify({'error': 'Invalid file type'}), 400

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    # --- find the target account from DB (first AccInfo row) ---
    target_acc = db.session.query(AccInfo).order_by(AccInfo.id.asc()).first()
    if not target_acc:
        return jsonify({'error': 'No account found in AccInfo table.'}), 404
    if not target_acc.acc_number:
        return jsonify({'error': 'First AccInfo row has no acc_number set.'}), 400

    target_number = str(target_acc.acc_number).strip()

    try:
        # --- read & normalize CSV ---
        df = pd.read_csv(file_path, sep=';', encoding='utf-8-sig')
        required_cols = {'Sender', 'Recipient', 'Amount', 'Balance', 'Booking date'}
        missing = required_cols - set(df.columns)
        if missing:
            return jsonify(
                {'error': f'Missing required columns: {", ".join(sorted(missing))}'}
            ), 400

        # strip spaces and normalize types
        df.columns = df.columns.str.strip()
        df['Sender'] = df['Sender'].astype(str).str.strip()
        df['Recipient'] = df['Recipient'].astype(str).str.strip()

        # Convert decimal comma to dot, handle thousands separators if present
        def _to_float(s):
            if isinstance(s, str):
                s = s.replace(' ', '').replace('\u00a0', '').replace('.', '').replace(',', '.')
            return float(s)

        df['Amount'] = df['Amount'].apply(_to_float)
        df['Balance'] = df['Balance'].apply(_to_float)

        # parse dates (allow both 2024/12/31 and 2024-12-31 just in case)
        try:
            df['Booking date'] = pd.to_datetime(
                df['Booking date'], format='%Y/%m/%d', errors='raise'
            )
        except ValueError:
            df['Booking date'] = pd.to_datetime(df['Booking date'], errors='raise')

        # --- filter rows for the target account number ---
        df_acc = df[(df['Sender'] == target_number) | (df['Recipient'] == target_number)]
        if df_acc.empty:
            return jsonify(
                {'error': f'No transactions found for account {target_number} in uploaded file.'}
            ), 400

        # --- pick latest balance by booking date ---
        latest_transaction = df_acc.sort_values('Booking date', ascending=False).iloc[0]
        latest_balance = float(latest_transaction['Balance'])

        # --- update AccInfo.value for the first account ---
        target_acc.value = str(latest_balance)
        db.session.commit()

        # --- (optional) also update the first Month.starting_funds ---
        first_month = db.session.query(Month).order_by(Month.id.asc()).first()
        if first_month:
            first_month.starting_funds = latest_balance
            db.session.commit()

        return jsonify(
            {
                'message': 'Updated',
                'account_number': target_number,
                'latest_balance': latest_balance,
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500
