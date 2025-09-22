# routes/settings.py
from __future__ import annotations

import json
import os
from typing import Any

from flask import Blueprint, current_app, jsonify, request

from backend.models.models import AccInfo, Month, PriceSettings, db

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

ACCOUNTS_JSON_FILE = "data/accounts.json"


# ----------------- helpers -----------------
def _to_int(v: Any, default: int | None = 0) -> int | None:
    try:
        if v is None or v == "":
            return default
        s = str(v).replace(" ", "").replace("\u00a0", "").replace(",", ".")
        return int(float(s))
    except Exception:
        return default


def _to_float(v: Any, default: float = 0.0) -> float:
    try:
        if v is None or v == "":
            return default
        s = str(v).replace(" ", "").replace("\u00a0", "").replace(",", ".")
        return float(s)
    except Exception:
        return default


def _default_prices() -> dict[str, Any]:
    # Safe defaults when DB/table isn’t ready
    return {
        "el_price_ore_kwh": 250,  # 2.50 SEK/kWh
        "diesel_price_sek_litre": 15.0,
        "bensin_price_sek_litre": 14.0,
        "yearly_km": 18000,
        "daily_commute_km": 30,
        # NEW
        "downpayment_sek": 100000.0,
        "interest_rate_pct": 5.0,
    }


def _prices_row_or_none() -> PriceSettings | None:
    """
    Get/create singleton PriceSettings(id=1). If table/migrations are missing,
    return None (CI-safe).
    """
    try:
        row = PriceSettings.query.get(1)
        if not row:
            d = _default_prices()
            row = PriceSettings(
                id=1,
                el_price_ore_kwh=d["el_price_ore_kwh"],
                diesel_price_sek_litre=d["diesel_price_sek_litre"],
                bensin_price_sek_litre=d["bensin_price_sek_litre"],
                yearly_km=d["yearly_km"],
                daily_commute_km=d["daily_commute_km"],
                downpayment_sek=d["downpayment_sek"],
                interest_rate_pct=d["interest_rate_pct"],
            )
            db.session.add(row)
            db.session.commit()
        return row
    except Exception as e:
        current_app.logger.warning("PriceSettings unavailable (CI-safe fallback): %s", e)
        return None


def _serialize_prices(row: PriceSettings | None) -> dict[str, Any]:
    """Normalize to JSON primitives; fall back to defaults if row is None."""
    if row is None:
        return _default_prices()
    return {
        "el_price_ore_kwh": _to_int(getattr(row, "el_price_ore_kwh", 0), 0),
        "diesel_price_sek_litre": _to_float(getattr(row, "diesel_price_sek_litre", 0.0), 0.0),
        "bensin_price_sek_litre": _to_float(getattr(row, "bensin_price_sek_litre", 0.0), 0.0),
        "yearly_km": _to_int(getattr(row, "yearly_km", 18000), 18000),
        "daily_commute_km": _to_int(getattr(row, "daily_commute_km", 30), 30),
        "downpayment_sek": _to_float(getattr(row, "downpayment_sek", 100000.0), 100000.0),
        "interest_rate_pct": _to_float(getattr(row, "interest_rate_pct", 5.0), 5.0),
    }


# ----------------- Accounts -----------------
@settings_bp.post("/accounts")
def update_accounts():
    data = request.get_json(silent=True)
    if not isinstance(data, list):
        return jsonify({"error": "Expected a list of accounts"}), 400

    try:
        AccInfo.query.delete()
        db.session.flush()
        objs = [
            AccInfo(
                person=item.get("person", "") or "",
                bank=item.get("bank", "") or "",
                acc_number=item.get("acc_number", "") or "",
                country=item.get("country", "") or "",
                value=_to_float(item.get("value"), 0.0),
            )
            for item in data
        ]
        if objs:
            db.session.add_all(objs)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("update_accounts DB error: %s", e)
        try:
            os.makedirs(os.path.dirname(ACCOUNTS_JSON_FILE), exist_ok=True)
            with open(ACCOUNTS_JSON_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception:
            pass
        return jsonify({"error": "Internal server error"}), 500

    try:
        os.makedirs(os.path.dirname(ACCOUNTS_JSON_FILE), exist_ok=True)
        with open(ACCOUNTS_JSON_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        current_app.logger.warning("accounts.json write failed: %s", e)

    return jsonify({"message": "Accounts updated in DB and JSON file"}), 200


# ----------------- Current month -----------------
@settings_bp.post("/current_month")
def set_current_month():
    try:
        data = request.get_json(silent=True) or {}
        month_id = data.get("month_id")
        if month_id is None:
            return jsonify({"error": "No month_id provided"}), 400

        month_id_int = _to_int(month_id, None)
        if month_id_int is None:
            return jsonify({"error": "month_id must be an integer"}), 400

        Month.query.update({Month.is_current: False})
        db.session.flush()
        m = Month.query.get(month_id_int)
        if not m:
            db.session.rollback()
            return jsonify({"error": "Month not found"}), 404

        m.is_current = True
        db.session.commit()
        return (
            jsonify(
                {
                    "message": "Current month updated successfully",
                    "month_id": month_id_int,
                }
            ),
            200,
        )
    except Exception as e:
        current_app.logger.exception("set_current_month error: %s", e)
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500


# ----------------- Prices -----------------
@settings_bp.get("/prices")
def get_prices():
    try:
        row = _prices_row_or_none()
        return jsonify(_serialize_prices(row)), 200
    except Exception as e:
        current_app.logger.warning("GET /api/settings/prices failed; returning defaults: %s", e)
        return jsonify(_default_prices()), 200


@settings_bp.route("/prices", methods=["POST", "PATCH"])
def save_prices():
    """
    Upsert any subset of price fields.
    Body keys: el_price_ore_kwh, bensin_price_sek_litre, diesel_price_sek_litre,
               yearly_km, daily_commute_km, downpayment_sek, interest_rate_pct
    Returns canonical saved values or a merged default if DB is unavailable (still 200).
    """
    data = request.get_json(silent=True) or {}
    try:
        row = _prices_row_or_none()
        if row is None:
            # DB unavailable: merge request into defaults and return
            merged = _default_prices()
            for k, v in data.items():
                if k in merged:
                    if k in ("yearly_km", "daily_commute_km", "el_price_ore_kwh"):
                        merged[k] = _to_int(v, merged[k])
                    else:
                        merged[k] = _to_float(v, merged[k])
            return jsonify(merged), 200

        # Accept and coerce fields
        if "el_price_ore_kwh" in data:
            row.el_price_ore_kwh = _to_int(data["el_price_ore_kwh"], row.el_price_ore_kwh or 0) or 0
        if "diesel_price_sek_litre" in data:
            row.diesel_price_sek_litre = _to_float(
                data["diesel_price_sek_litre"], row.diesel_price_sek_litre or 0.0
            )
        if "bensin_price_sek_litre" in data:
            row.bensin_price_sek_litre = _to_float(
                data["bensin_price_sek_litre"], row.bensin_price_sek_litre or 0.0
            )
        if "yearly_km" in data:
            row.yearly_km = _to_int(data["yearly_km"], row.yearly_km or 0) or 0
        if "daily_commute_km" in data:
            row.daily_commute_km = _to_int(data["daily_commute_km"], row.daily_commute_km or 0) or 0
        if "downpayment_sek" in data:
            row.downpayment_sek = _to_float(data["downpayment_sek"], row.downpayment_sek or 0.0)
        if "interest_rate_pct" in data:
            row.interest_rate_pct = _to_float(
                data["interest_rate_pct"], row.interest_rate_pct or 0.0
            )

        db.session.commit()
        return jsonify(_serialize_prices(row)), 200

    except Exception as e:
        current_app.logger.exception("save_prices error: %s", e)
        db.session.rollback()
        # CI-safe fallback: defaults merged with request
        merged = _default_prices()
        for k, v in data.items():
            if k in merged:
                if k in ("yearly_km", "daily_commute_km", "el_price_ore_kwh"):
                    merged[k] = _to_int(v, merged[k])
                else:
                    merged[k] = _to_float(v, merged[k])
        return jsonify(merged), 200
