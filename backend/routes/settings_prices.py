# backend/routes/settings_prices.py
from flask import Blueprint, jsonify, request
from models.models import db
from models.models import AppSettings  # import the model above

settings_prices_bp = Blueprint("settings_prices", __name__, url_prefix="/api/settings")

@settings_prices_bp.route("/prices", methods=["GET"])
def get_prices():
    s = AppSettings.get_or_create()
    return jsonify({
        "electricity_price_ore_kwh": s.electricity_price_ore_kwh,
        "bensin_price_sek_litre": float(s.bensin_price_sek_litre),
        "diesel_price_sek_litre": float(s.diesel_price_sek_litre),
        "yearly_driving_km": s.yearly_driving_km,
        "daily_commute_km": s.daily_commute_km,
    })

@settings_prices_bp.route("/prices", methods=["POST"])
def save_prices():
    data = request.get_json(force=True) or {}
    s = AppSettings.get_or_create()

    # Update only provided fields; coerce types safely
    def n_int(v, default): 
        try: return int(v)
        except: return default
    def n_dec(v, default):
        try: return float(v)
        except: return default

    if "electricity_price_ore_kwh" in data:
        s.electricity_price_ore_kwh = n_int(data["electricity_price_ore_kwh"], s.electricity_price_ore_kwh)
    if "bensin_price_sek_litre" in data:
        s.bensin_price_sek_litre = n_dec(data["bensin_price_sek_litre"], float(s.bensin_price_sek_litre))
    if "diesel_price_sek_litre" in data:
        s.diesel_price_sek_litre = n_dec(data["diesel_price_sek_litre"], float(s.diesel_price_sek_litre))
    if "yearly_driving_km" in data:
        s.yearly_driving_km = n_int(data["yearly_driving_km"], s.yearly_driving_km)
    if "daily_commute_km" in data:
        s.daily_commute_km = n_int(data["daily_commute_km"], s.daily_commute_km)

    db.session.commit()
    return jsonify({"ok": True})
