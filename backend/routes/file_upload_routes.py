from flask import Blueprint, jsonify, request
import os
import pandas as pd
from models.models import AccInfo, Month, db

# 👇 add /api in the blueprint prefix so the final path is /api/upload/csv
file_upload_bp = Blueprint("file_upload", __name__, url_prefix="/api/upload")

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"csv"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@file_upload_bp.route("/csv", methods=["POST"])
def upload_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    if not (file and allowed_file(file.filename)):
        return jsonify({"error": "Invalid file type"}), 400

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    try:
        df = pd.read_csv(file_path, sep=";", encoding="utf-8-sig")
        df.columns = df.columns.str.strip()
        df["Sender"] = df["Sender"].astype(str).str.strip()
        df["Recipient"] = df["Recipient"].astype(str).str.strip()
        df["Amount"] = df["Amount"].str.replace(",", ".").astype(float)
        df["Balance"] = df["Balance"].str.replace(",", ".").astype(float)
        df["Booking date"] = pd.to_datetime(df["Booking date"], format="%Y/%m/%d")

        # Filter using the account number from your CSV to target Janne (Sweden)
        df = df[(df["Sender"] == "790525-1034") | (df["Recipient"] == "790525-1034")]
        if df.empty:
            return jsonify({"error": "No transactions found for the selected account."}), 400

        latest_transaction = df.sort_values("Booking date", ascending=False).iloc[0]
        latest_balance = float(latest_transaction["Balance"])

        acc_info_entry = (
        AccInfo.query.filter_by(
            person="Janne", bank="Nordea", country="Sweden", acc_number="790525-1034"
        ).first()
        )

        if not acc_info_entry:
            return jsonify({'error': 'Nordea Sweden account 790525-1034 not found.'}), 404

        acc_info_entry.value = str(latest_balance)
        db.session.commit()
        first_month = db.session.query(Month).order_by(Month.id).first()
        if first_month:
            first_month.starting_funds = latest_balance
            db.session.commit()

        return jsonify({"message": "Updated", "latest_balance": latest_balance}), 200

    except Exception as e:
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500
