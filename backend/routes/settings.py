# routes/settings.py
import json
import os

from flask import Blueprint, jsonify, request

from models.models import AccInfo, Month, PriceSettings, db

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

ACCOUNTS_JSON_FILE = "data/accounts.json"


# ----------------- helpers -----------------
def to_int(v, default=0):
    try:
        if v is None or v == "":
            return default
        return int(float(str(v).replace(" ", "").replace("\u00A0", "").replace(",", ".")))
    except Exception:
        return default


def to_float(v, default=0.0):
    try:
        if v is None or v == "":
            return default
        return float(str(v).replace(" ", "").replace("\u00A0", "").replace(",", "."))
    except Exception:
        return default


def get_or_create_prices():
    row = PriceSettings.query.get(1)
    if not row:
        # Provide sensible defaults on first creation
        row = PriceSettings(
            id=1,
            el_price_ore_kwh=250,          # 2.50 SEK/kWh
            diesel_price_sek_litre=15.0,
            bensin_price_sek_litre=14.0,
            yearly_km=18000,
            daily_commute_km=30,
        )
        db.session.add(row)
        db.session.commit()
    return row


# ----------------- Accounts -----------------
@settings_bp.route("/accounts", methods=["POST"])
def update_accounts():
    data = request.get_json(silent=True)
    if not isinstance(data, list):
        return jsonify({"error": "Expected a list of accounts"}), 400

    # Replace all accounts with provided list
    AccInfo.query.delete()
    for item in data:
        account = AccInfo(
            person=item.get("person", ""),
            bank=item.get("bank", ""),
            acc_number=item.get("acc_number", ""),
            country=item.get("country", ""),
            value=to_float(item.get("value"), 0.0),
        )
        db.session.add(account)
    db.session.commit()

    # Persist also to JSON (optional)
    os.makedirs(os.path.dirname(ACCOUNTS_JSON_FILE), exist_ok=True)
    with open(ACCOUNTS_JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return jsonify({"message": "Accounts updated in DB and JSON file"}), 200


# ----------------- Current month -----------------
@settings_bp.route("/current_month", methods=["POST"])
def set_current_month():
    try:
        data = request.get_json(silent=True) or {}
        month_id = data.get("month_id")
        if month_id is None:
            return jsonify({"error": "No month_id provided"}), 400

        month_id = to_int(month_id, None)
        if month_id is None:
            return jsonify({"error": "month_id must be an integer"}), 400

        # Unset all, then set selected one
        Month.query.update({Month.is_current: False})
        db.session.flush()

        selected_month = Month.query.get(month_id)
        if not selected_month:
            return jsonify({"error": "Month not found"}), 404

        selected_month.is_current = True
        db.session.commit()
        return jsonify({"message": "Current month updated successfully"}), 200

    except Exception as e:
        print(f"❌ Error updating current month: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500


# ----------------- Prices -----------------
@settings_bp.route("/prices", methods=["GET"])
def get_prices():
    row = get_or_create_prices()
    # Normalize response to primitives (no None)
    return jsonify({
        "el_price_ore_kwh": to_int(row.el_price_ore_kwh, 0),
        "diesel_price_sek_litre": to_float(row.diesel_price_sek_litre, 0.0),
        "bensin_price_sek_litre": to_float(row.bensin_price_sek_litre, 0.0),
        "yearly_km": to_int(row.yearly_km, 18000),
        "daily_commute_km": to_int(getattr(row, "daily_commute_km", 30), 30),
    }), 200


@settings_bp.route("/prices", methods=["POST"])
def save_prices():
    data = request.get_json(silent=True) or {}
    row = get_or_create_prices()
    try:
        if "el_price_ore_kwh" in data:
            row.el_price_ore_kwh = to_int(data["el_price_ore_kwh"], row.el_price_ore_kwh or 0)
        if "diesel_price_sek_litre" in data:
            row.diesel_price_sek_litre = to_float(data["diesel_price_sek_litre"], row.diesel_price_sek_litre or 0.0)
        if "bensin_price_sek_litre" in data:
            row.bensin_price_sek_litre = to_float(data["bensin_price_sek_litre"], row.bensin_price_sek_litre or 0.0)
        if "yearly_km" in data:
            row.yearly_km = to_int(data["yearly_km"], row.yearly_km or 0)
        if "daily_commute_km" in data:
            row.daily_commute_km = to_int(data["daily_commute_km"], row.daily_commute_km or 0)

        db.session.commit()

        # Return the canonical, normalized payload after save
        return get_prices()

    except Exception as e:
        db.session.rollback()
        print("❌ save_prices error:", e)
        return jsonify({"error": "Internal server error"}), 500
