import os
from flask import Blueprint, request, jsonify
import pandas as pd
from models.models import db, AccInfo, Month

file_upload_bp = Blueprint('file_upload', __name__, url_prefix='/upload')

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@file_upload_bp.route('/csv', methods=['POST'])
def upload_csv():
    print("=== CSV Upload Route Triggered ===")
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)

        try:
            # Load and clean the CSV
            df = pd.read_csv(file_path, sep=';', encoding='utf-8-sig')
            df.columns = df.columns.str.strip()

            df['Sender'] = df['Sender'].astype(str).str.strip()
            df['Recipient'] = df['Recipient'].astype(str).str.strip()
            df['Amount'] = df['Amount'].str.replace(',', '.').astype(float)
            df['Balance'] = df['Balance'].str.replace(',', '.').astype(float)
            df['Booking date'] = pd.to_datetime(df['Booking date'], format='%Y/%m/%d')

            print("=== RAW CSV DATA ===")
            print(df.head(10))
            print(df.columns)

            # Filter where Janne Sweden is either Sender or Recipient
            df = df[(df['Sender'] == '790525-1034') | (df['Recipient'] == '790525-1034')]

            print(df.head())
            print(df[['Sender', 'Recipient']].drop_duplicates())

            if df.empty:
                return jsonify({'error': 'No transactions found for Janne Sweden account.'}), 400

            # Find the most recent transaction
            latest_transaction = df.sort_values('Booking date', ascending=False).iloc[0]
            latest_balance = float(latest_transaction['Balance'])  # Ensure Python float

            # Update the Acc_info table entry for janne_sweden
            acc_info_entry = AccInfo.query.filter_by(key='janne_sweden').first()
            print(f"Found acc_info entry: {acc_info_entry}")
            if not acc_info_entry:
                return jsonify({'error': 'Acc_info entry for janne_sweden not found.'}), 404

            acc_info_entry.value = str(latest_balance)
            print(f"Updating janne_sweden to {latest_balance}")
            db.session.commit()

            # Also update the first month's starting funds
            first_month = db.session.query(Month).order_by(Month.id).first()
            if first_month:
                first_month.starting_funds = latest_balance
                db.session.commit()

            return jsonify({'message': f'Acc_info entry for janne_sweden updated to {latest_balance} SEK.', 'latest_balance': latest_balance}), 200

        except Exception as e:
            return jsonify({'error': f'Processing failed: {str(e)}'}), 500

    return jsonify({'error': 'Invalid file type'}), 400
