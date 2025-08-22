# backend/routes/settings_prices.py
from flask import Blueprint, jsonify, request
from models.models import db, PriceSettings  # <-- use the correct model

settings_prices_bp = Blueprint("settings_prices", __name__, url_prefix="/api/settings")


# --- helpers ---------------------------------------------------------------

def _get_or_create_prices():
    ps = PriceSettings.query.get(1)
    if not ps:
        ps = PriceSettings(
            id=1,
            el_price_ore_kwh=250,
            bensin_price_sek_litre=14,
            diesel_price_sek_litre=15,
            yearly_km=18000,
            daily_commute_km=30,
        )
        db.session.add(ps)
        db.session.commit()
    return ps


def _to_num(v, cast=float, default=None):
    try:
        if v is None or v == "":
            return default
        return cast(v)
    except Exception:
        return default


# --- routes ----------------------------------------------------------------

@settings_prices_bp.route("/prices", methods=["GET"])
def get_prices():
    s = _get_or_create_prices()
    return jsonify({
        "el_price_ore_kwh": int(s.el_price_ore_kwh),
        "bensin_price_sek_litre": float(s.bensin_price_sek_litre),
        "diesel_price_sek_litre": float(s.diesel_price_sek_litre),
        "yearly_km": int(s.yearly_km),
        "daily_commute_km": int(s.daily_commute_km),
    })


@settings_prices_bp.route("/prices", methods=["POST"])
def save_prices():
    data = request.get_json(force=True) or {}
    s = _get_or_create_prices()

    # Accept both new and legacy keys; new keys take precedence if both present.
    el_price = data.get("el_price_ore_kwh", data.get("electricity_price_ore_kwh"))
    bensin   = data.get("bensin_price_sek_litre")
    diesel   = data.get("diesel_price_sek_litre")
    yearly   = data.get("yearly_km", data.get("yearly_driving_km"))
    commute  = data.get("daily_commute_km", data.get("daily_commute"))

    # Safely coerce and update only provided fields
    if el_price is not None:
        s.el_price_ore_kwh = _to_num(el_price, int, s.el_price_ore_kwh)
    if bensin is not None:
        s.bensin_price_sek_litre = _to_num(bensin, float, s.bensin_price_sek_litre)
    if diesel is not None:
        s.diesel_price_sek_litre = _to_num(diesel, float, s.diesel_price_sek_litre)
    if yearly is not None:
        s.yearly_km = _to_num(yearly, int, s.yearly_km)
    if commute is not None:
        s.daily_commute_km = _to_num(commute, int, s.daily_commute_km)

    db.session.commit()

    return jsonify({
        "ok": True,
        "el_price_ore_kwh": int(s.el_price_ore_kwh),
        "bensin_price_sek_litre": float(s.bensin_price_sek_litre),
        "diesel_price_sek_litre": float(s.diesel_price_sek_litre),
        "yearly_km": int(s.yearly_km),
        "daily_commute_km": int(s.daily_commute_km),
    })
