from __future__ import annotations
from typing import List, Dict, Any

from flask import Blueprint, jsonify, request, current_app
from backend.models.models import Car, PriceSettings, db

from .serialize import serialize_car, compute_derived
from .pricing import normalize_prices

cars_bp = Blueprint("cars", __name__, url_prefix="/api")


@cars_bp.get("/cars/_which")
def which_handler():
    return {"handler": "car_evaluation"}


@cars_bp.get("/cars")
@cars_bp.get("/cars/")
def list_cars():
    """
    Return all cars with derived fields (TCO includes financing).
    CI-safe: returns [] with 200 if the table is missing.
    """
    try:
        cars: List[Car] = Car.query.order_by(Car.id).all()
    except Exception as e:
        current_app.logger.warning("GET /api/cars failed; returning []: %s", e)
        return jsonify([]), 200

    # Fetch settings row if available; normalize with defaults otherwise
    try:
        ps = PriceSettings.query.get(1)
    except Exception:
        ps = None

    rows = [serialize_car(c, ps) for c in cars]
    return jsonify(rows), 200


@cars_bp.get("/cars/categories")
def car_categories():
    """
    Distinct lists for filters. CI-safe: return empty sets on DB errors.
    """
    try:
        body_styles = [
            r[0] for r in db.session.query(Car.body_style).distinct() if r[0] is not None
        ]
        eu_segments = [
            r[0] for r in db.session.query(Car.eu_segment).distinct() if r[0] is not None
        ]
        suv_tiers = [
            r[0] for r in db.session.query(Car.suv_tier).distinct() if r[0] is not None
        ]
        resp = jsonify({
            "body_styles": sorted({str(b) for b in body_styles if b}),
            "eu_segments": sorted({str(s) for s in eu_segments if s}),
            "suv_tiers": sorted({str(t) for t in suv_tiers if t}),
        })
        resp.headers["X-Cars-Handler"] = "car_evaluation"
        return resp, 200
    except Exception as e:
        current_app.logger.warning("GET /api/cars/categories failed, returning empty sets: %s", e)
        resp = jsonify({"body_styles": [], "eu_segments": [], "suv_tiers": []})
        resp.headers["X-Cars-Handler"] = "car_evaluation"
        return resp, 200


@cars_bp.post("/cars/update")
def update_cars():
    """
    Bulk update some fields. If body is not a list, recompute TCO for all cars.
    Persists the TCO values computed with financing so spreadsheets/exports can reuse.
    """
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, list):
            ids = [i for (i,) in db.session.query(Car.id).all()]
            payload = [{"id": i} for i in ids]

        # Settings row (create if missing to avoid later failures)
        try:
            ps = PriceSettings.query.get(1)
            if not ps:
                ps = PriceSettings(id=1)
                db.session.add(ps)
                db.session.commit()
        except Exception:
            ps = None

        updated = 0
        for p in payload:
            car = Car.query.get(p.get("id"))
            if not car:
                continue

            # basic fields
            if "model" in p: car.model = p["model"] or car.model
            if "year" in p and p["year"] is not None: car.year = int(p["year"])
            if "type_of_vehicle" in p: car.type_of_vehicle = p["type_of_vehicle"] or car.type_of_vehicle

            for k in ("body_style", "eu_segment", "suv_tier", "dc_time_source", "ac_time_source"):
                if k in p:
                    setattr(car, k, p[k] or getattr(car, k))

            # consumption: accept either key
            if "consumption_kwh_100km" in p or "consumption_kwh_per_100km" in p:
                raw = p.get("consumption_kwh_100km", p.get("consumption_kwh_per_100km"))
                car.consumption_kwh_per_100km = float(raw or 0)
            for k in (
                "consumption_l_per_100km",
                "estimated_purchase_price",
                "summer_tires_price",
                "winter_tires_price",
                "acceleration_0_100",
                "battery_capacity_kwh",
                "trunk_size_litre",
                "full_insurance_year",
                "half_insurance_year",
                "car_tax_year",
                "repairs_year",
                "dc_peak_kw",
                "dc_time_min_10_80",
                "ac_onboard_kw",
                "ac_time_h_0_100",
            ):
                if k in p:
                    setattr(car, k, float(p[k] or 0))

            if "range_km" in p:
                car.range_km = int(p["range_km"] or 0)

            # recompute & persist TCO totals using current settings (financing-aware)
            try:
                d = compute_derived(car, ps)
                car.tco_3_years = d["tco_3_years"]
                car.tco_5_years = d["tco_5_years"]
                car.tco_8_years = d["tco_8_years"]
            except Exception as e:
                current_app.logger.debug("persist TCO failed for car %s: %s", getattr(car, "id", "?"), e)

            updated += 1

        db.session.commit()
        resp = jsonify({"updated": updated, "message": "Cars updated"})
        resp.headers["X-Cars-Handler"] = "car_evaluation"
        return resp, 200

    except Exception as e:
        current_app.logger.warning("/api/cars/update failed: %s", e)
        db.session.rollback()
        resp = jsonify({"error": "Internal server error"})
        resp.headers["X-Cars-Handler"] = "car_evaluation"
        return resp, 500
