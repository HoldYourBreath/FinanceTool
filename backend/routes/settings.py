# routes/settings.py
from __future__ import annotations

import json
import os
from typing import Any, Dict

from flask import Blueprint, jsonify, request

from models.models import AccInfo, Month, PriceSettings, db

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

ACCOUNTS_JSON_FILE = "data/accounts.json"


# ----------------- helpers -----------------
def _to_int(v: Any, default: int = 0) -> int:
    """
    Coerce value to int, tolerating spaces, NBSP, commas.
    Empty/None -> default.
    """
    try:
        if v is None or v == "":
            return default
        s = str(v).replace(" ", "").replace("\u00A0", "").replace(",", ".")
        return int(float(s))
    except Exception:
        return default


def _to_float(v: Any, default: float = 0.0) -> float:
    """
    Coerce value to float, tolerating spaces, NBSP, commas.
    Empty/None -> default.
    """
    try:
        if v is None or v == "":
            return default
        s = str(v).replace(" ", "").replace("\u00A0", "").replace(",", ".")
        return float(s)
    except Exception:
        return default


def _prices_row() -> PriceSettings:
    """
    Return the singleton PriceSettings row (id=1),
    creating it with sensible defaults if missing.
    """
    row = PriceSettings.query.get(1)
    if not row:
        row = PriceSettings(
            id=1,
            el_price_ore_kwh=250,       # 2.50 SEK/kWh
            diesel_price_sek_litre=15.0,
            bensin_price_sek_litre=14.0,
            yearly_km=18000,
            daily_commute_km=30,
        )
        db.session.add(row)
        db.session.commit()
    return row


def _serialize_prices(row: PriceSettings) -> Dict[str, Any]:
    """Normalize model -> JSON primitives (no None)."""
    return {
        "el_price_ore_kwh": _to_int(getattr(row, "el_price_ore_kwh", 0), 0),
        "diesel_price_sek_litre": _to_float(getattr(row, "diesel_price_sek_litre", 0.0), 0.0),
        "bensin_price_sek_litre": _to_float(getattr(row, "bensin_price_sek_litre", 0.0), 0.0),
        "yearly_km": _to_int(getattr(row, "yearly_km", 18000), 18000),
        "daily_commute_km": _to_int(getattr(row, "daily_commute_km", 30), 30),
    }


# ----------------- Accounts -----------------
@settings_bp.route("/accounts", methods=["POST"])
def update_accounts():
    """
    Replace all account rows with the provided list.
    Body: [{ person, bank, acc_number, country, value }]
    Also mirrored to data/accounts.json for convenience.
    """
    data = request.get_json(silent=True)
    if not isinstance(data, list):
        return jsonify({"error": "Expected a list of accounts"}), 400

    try:
        # Replace all accounts with provided list
        AccInfo.query.delete()
        db.session.flush()

        objects = []
        for item in data:
            objects.append(
                AccInfo(
                    person=item.get("person", "") or "",
                    bank=item.get("bank", "") or "",
                    acc_number=item.get("acc_number", "") or "",
                    country=item.get("country", "") or "",
                    value=_to_float(item.get("value"), 0.0),
                )
            )
        if objects:
            db.session.add_all(objects)
        db.session.commit()

        # Persist also to JSON (optional)
        os.makedirs(os.path.dirname(ACCOUNTS_JSON_FILE), exist_ok=True)
        with open(ACCOUNTS_JSON_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return jsonify({"message": "Accounts updated in DB and JSON file"}), 200
    except Exception as e:
        db.session.rollback()
        print("❌ update_accounts error:", e)
        return jsonify({"error": "Internal server error"}), 500


# ----------------- Current month -----------------
@settings_bp.route("/current_month", methods=["POST"])
def set_current_month():
    """
    Body: { "month_id": <int> }
    Sets Month.is_current = True for the given month and False for all others.
    """
    try:
        data = request.get_json(silent=True) or {}
        month_id = data.get("month_id")
        if month_id is None:
            return jsonify({"error": "No month_id provided"}), 400

        month_id = _to_int(month_id, None)
        if month_id is None:
            return jsonify({"error": "month_id must be an integer"}), 400

        # Unset all, then set selected one
        Month.query.update({Month.is_current: False})
        db.session.flush()

        selected_month = Month.query.get(month_id)
        if not selected_month:
            db.session.rollback()
            return jsonify({"error": "Month not found"}), 404

        selected_month.is_current = True
        db.session.commit()
        return jsonify({"message": "Current month updated successfully", "month_id": month_id}), 200

    except Exception as e:
        print(f"❌ Error updating current month: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500


# ----------------- Prices -----------------
@settings_bp.route("/prices", methods=["GET"])
def get_prices():
    """
    Returns the current Energy/Fuel/Commute settings used by Car Evaluation.
    """
    row = _prices_row()
    return jsonify(_serialize_prices(row)), 200


@settings_bp.route("/prices", methods=["POST", "PATCH"])
def save_prices():
    """
    Upserts any subset of the price fields.
    Body: {
      el_price_ore_kwh, bensin_price_sek_litre, diesel_price_sek_litre,
      yearly_km, daily_commute_km
    }
    Returns the canonical saved values.
    """
    data = request.get_json(silent=True) or {}
    row = _prices_row()
    try:
        if "el_price_ore_kwh" in data:
            row.el_price_ore_kwh = _to_int(data["el_price_ore_kwh"], row.el_price_ore_kwh or 0)
        if "diesel_price_sek_litre" in data:
            row.diesel_price_sek_litre = _to_float(data["diesel_price_sek_litre"], row.diesel_price_sek_litre or 0.0)
        if "bensin_price_sek_litre" in data:
            row.bensin_price_sek_litre = _to_float(data["bensin_price_sek_litre"], row.bensin_price_sek_litre or 0.0)
        if "yearly_km" in data:
            row.yearly_km = _to_int(data["yearly_km"], row.yearly_km or 0)
        if "daily_commute_km" in data:
            row.daily_commute_km = _to_int(data["daily_commute_km"], row.daily_commute_km or 0)

        db.session.commit()
        # Return the canonical, normalized payload after save
        return jsonify(_serialize_prices(row)), 200

    except Exception as e:
        db.session.rollback()
        print("❌ save_prices error:", e)
        return jsonify({"error": "Internal server error"}), 500
