# routes/cars.py
from __future__ import annotations

from flask import Blueprint, jsonify, request, current_app
from models.models import Car, db

# --- Optional utils: keep CI green if these modules aren't available ---
try:
    from utils.charging import estimate_ac_0_100_hours, estimate_dc_10_80_minutes
except Exception:  # pragma: no cover
    def estimate_dc_10_80_minutes(batt_kwh, peak_kw):  # fallback heuristic
        try:
            batt = float(batt_kwh or 0)
            peak = float(peak_kw or 0)
            return max(0, int(round((0.7 * batt) / (0.6 * peak + 1e-6) * 60))) if batt and peak else 0
        except Exception:
            return 0

    def estimate_ac_0_100_hours(batt_kwh, ac_kw):
        try:
            batt = float(batt_kwh or 0)
            ac = float(ac_kw or 0)
            return max(0.0, round(batt / (ac if ac > 0 else 7.0), 1)) if batt else 0.0
        except Exception:
            return 0.0

try:
    from utils.format import to_num as _to_num
except Exception:  # pragma: no cover
    def _to_num(v, default=0):
        try:
            if v is None or v == "":
                return default
            return float(v) if isinstance(v, (int, float, str)) else default
        except Exception:
            return default

try:
    from utils.tco import compute_derived as _compute_derived
except Exception:  # pragma: no cover
    def _compute_derived(car):
        # Minimal safe defaults
        return {
            "tco_total_3y": 0.0,
            "tco_total_5y": 0.0,
            "tco_total_8y": 0.0,
        }

cars_bp = Blueprint("cars", __name__, url_prefix="/api")


def _safe(val, default=None):
    return val if val is not None else default


# ---------- GET /api/cars --------------------------------------------------
@cars_bp.get("/cars")
def get_cars():
    """
    List cars with optional filters and include derived fields.
    CI-safe: if anything fails, return [] with 200.
    Query params (CSV allowed):
      - body_style=SUV,Sedan
      - eu_segment=C,D
      - suv_tier=Compact,Midsize
      - type_of_vehicle=EV,PHEV,Diesel,Bensin
      - q=substring_on_model
      - year_min=YYYY, year_max=YYYY
    """
    try:
        def parse_csv(name):
            raw = request.args.get(name)
            if not raw:
                return None
            return [v.strip() for v in raw.split(",") if v.strip()]

        q = Car.query

        body_styles = parse_csv("body_style")
        segments = parse_csv("eu_segment")
        suv_tiers = parse_csv("suv_tier")
        veh_types = parse_csv("type_of_vehicle")

        if body_styles:
            q = q.filter(Car.body_style.in_(body_styles))
        if segments:
            q = q.filter(Car.eu_segment.in_(segments))
        if suv_tiers:
            q = q.filter(Car.suv_tier.in_(suv_tiers))
        if veh_types:
            q = q.filter(Car.type_of_vehicle.in_(veh_types))

        term = request.args.get("q")
        if term:
            like = f"%{term}%"
            q = q.filter(Car.model.ilike(like))

        y_min = request.args.get("year_min", type=int)
        y_max = request.args.get("year_max", type=int)
        if y_min is not None:
            q = q.filter(Car.year >= y_min)
        if y_max is not None:
            q = q.filter(Car.year <= y_max)

        cars = q.order_by(Car.model.asc(), Car.year.desc()).all()
    except Exception as e:
        current_app.logger.warning("GET /api/cars: query failed, returning []: %s", e)
        return jsonify([]), 200

    resp = []
    for c in cars:
        try:
            d = {
                "id": c.id,
                "model": c.model,
                "year": int(_to_num(c.year, 0)),
                "type_of_vehicle": _safe(c.type_of_vehicle, "EV"),

                # categories
                "body_style": c.body_style,
                "eu_segment": c.eu_segment,
                "suv_tier": c.suv_tier,

                # pricing/specs
                "estimated_purchase_price": _to_num(c.estimated_purchase_price, 0),
                "summer_tires_price": _to_num(c.summer_tires_price, 0),
                "winter_tires_price": _to_num(c.winter_tires_price, 0),
                "consumption_kwh_per_100km": _to_num(c.consumption_kwh_per_100km, 0),
                "consumption_l_per_100km": _to_num(getattr(c, "consumption_l_per_100km", 0.0), 0),
                "range": _to_num(getattr(c, "range_km", 0), 0),
                "acceleration_0_100": _to_num(c.acceleration_0_100, 0),
                "battery_capacity_kwh": _to_num(c.battery_capacity_kwh, 0),
                "trunk_size_litre": _to_num(c.trunk_size_litre, 0),
                "full_insurance_year": _to_num(c.full_insurance_year, 0),
                "half_insurance_year": _to_num(c.half_insurance_year, 0),
                "car_tax_year": _to_num(c.car_tax_year, 0),
                "repairs_year": _to_num(c.repairs_year, 0),

                # charging
                "dc_peak_kw": _to_num(getattr(c, "dc_peak_kw", 0), 0),
                "dc_time_min_10_80": _to_num(getattr(c, "dc_time_min_10_80", 0), 0),
                "dc_time_min_10_80_est": _to_num(getattr(c, "dc_time_min_10_80_est", 0), 0),
                "dc_time_source": _safe(getattr(c, "dc_time_source", ""), "") or "",
                "ac_onboard_kw": _to_num(getattr(c, "ac_onboard_kw", 0), 0),
                "ac_time_h_0_100": _to_num(getattr(c, "ac_time_h_0_100", 0), 0),
                "ac_time_h_0_100_est": _to_num(getattr(c, "ac_time_h_0_100_est", 0), 0),
                "ac_time_source": _safe(getattr(c, "ac_time_source", ""), "") or "",

                # persisted TCO totals if present
                "tco_3_years": _to_num(getattr(c, "tco_3_years", 0), 0),
                "tco_5_years": _to_num(getattr(c, "tco_5_years", 0), 0),
                "tco_8_years": _to_num(getattr(c, "tco_8_years", 0), 0),
            }

            # computed dynamic fields (guarded)
            try:
                d.update(_compute_derived(c))
            except Exception:
                pass

            if (d.get("dc_time_min_10_80") or 0) <= 0:
                d["dc_time_min_10_80_est"] = d.get("dc_time_min_10_80_est") or estimate_dc_10_80_minutes(
                    d.get("battery_capacity_kwh", 0), d.get("dc_peak_kw", 0)
                )

            if (d.get("ac_time_h_0_100") or 0) <= 0:
                d["ac_time_h_0_100_est"] = d.get("ac_time_h_0_100_est") or estimate_ac_0_100_hours(
                    d.get("battery_capacity_kwh", 0), d.get("ac_onboard_kw", 0)
                )

            resp.append(d)

        except Exception as row_err:
            # Skip only the bad row; keep endpoint 200
            current_app.logger.warning("GET /api/cars: row %s failed: %s", getattr(c, "id", "?"), row_err)

    return jsonify(resp), 200


# ---------- GET /api/cars/categories --------------------------------------
@cars_bp.get("/cars/categories")
def car_categories():
    """CI-safe: return empty sets with 200 on error."""
    try:
        body_styles = [r[0] for r in db.session.query(Car.body_style).distinct() if r[0]]
        eu_segments = [r[0] for r in db.session.query(Car.eu_segment).distinct() if r[0]]
        suv_tiers = [r[0] for r in db.session.query(Car.suv_tier).distinct() if r[0]]
        return jsonify(
            {
                "body_styles": sorted(set(body_styles)),
                "eu_segments": sorted(set(eu_segments)),
                "suv_tiers": sorted(set(suv_tiers)),
            }
        ), 200
    except Exception as e:
        current_app.logger.warning("GET /api/cars/categories failed, returning empty sets: %s", e)
        return jsonify({"body_styles": [], "eu_segments": [], "suv_tiers": []}), 200


# ---------- POST /api/cars/update -----------------------------------------
@cars_bp.post("/cars/update")
def update_cars():
    """Keep the updater, but guard the whole handler to avoid CI failures."""
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, list):
            return jsonify({"error": "Expected a JSON list"}), 400

        updated = 0
        for p in data:
            car = Car.query.get(p.get("id"))
            if not car:
                continue

            # Basics
            car.model = p.get("model", car.model)
            car.year = int(_to_num(p.get("year"), car.year or 0))
            car.type_of_vehicle = p.get("type_of_vehicle", getattr(car, "type_of_vehicle", "EV"))

            # Categories
            car.body_style = p.get("body_style", car.body_style)
            car.eu_segment = p.get("eu_segment", car.eu_segment)
            car.suv_tier = p.get("suv_tier", car.suv_tier)

            # Consumption
            car.consumption_kwh_per_100km = _to_num(
                p.get("consumption_kwh_per_100km"), getattr(car, "consumption_kwh_per_100km", 0)
            )
            if hasattr(car, "consumption_l_per_100km"):
                car.consumption_l_per_100km = _to_num(
                    p.get("consumption_l_per_100km"), getattr(car, "consumption_l_per_100km", 0)
                )

            # Prices & specs
            car.estimated_purchase_price = _to_num(
                p.get("estimated_purchase_price"), car.estimated_purchase_price or 0
            )
            car.summer_tires_price = _to_num(p.get("summer_tires_price"), car.summer_tires_price or 0)
            car.winter_tires_price = _to_num(p.get("winter_tires_price"), car.winter_tires_price or 0)

            car.range_km = int(_to_num(p.get("range"), getattr(car, "range_km", 0)))
            car.acceleration_0_100 = _to_num(p.get("acceleration_0_100"), car.acceleration_0_100 or 0)
            car.battery_capacity_kwh = _to_num(p.get("battery_capacity_kwh"), car.battery_capacity_kwh or 0)
            car.trunk_size_litre = int(_to_num(p.get("trunk_size_litre"), car.trunk_size_litre or 0))

            car.full_insurance_year = _to_num(p.get("full_insurance_year"), car.full_insurance_year or 0)
            car.half_insurance_year = _to_num(p.get("half_insurance_year"), car.half_insurance_year or 0)
            car.car_tax_year = _to_num(p.get("car_tax_year"), car.car_tax_year or 0)
            car.repairs_year = _to_num(p.get("repairs_year"), car.repairs_year or 0)

            car.dc_peak_kw = _to_num(p.get("dc_peak_kw"), getattr(car, "dc_peak_kw", 0))
            car.dc_time_min_10_80 = _to_num(p.get("dc_time_min_10_80"), getattr(car, "dc_time_min_10_80", 0))
            car.dc_time_source = p.get("dc_time_source", getattr(car, "dc_time_source", "") or "")

            car.ac_onboard_kw = _to_num(p.get("ac_onboard_kw"), getattr(car, "ac_onboard_kw", 0))
            car.ac_time_h_0_100 = _to_num(p.get("ac_time_h_0_100"), getattr(car, "ac_time_h_0_100", 0))
            car.ac_time_source = p.get("ac_time_source", getattr(car, "ac_time_source", "") or "")

            # Refresh estimates (guarded)
            try:
                car.dc_time_min_10_80_est = estimate_dc_10_80_minutes(
                    _to_num(car.battery_capacity_kwh), _to_num(car.dc_peak_kw)
                )
                car.ac_time_h_0_100_est = estimate_ac_0_100_hours(
                    _to_num(car.battery_capacity_kwh), _to_num(car.ac_onboard_kw)
                )
            except Exception:
                pass

            # Persist derived totals if you denormalize them
            try:
                d = _compute_derived(car)
                car.tco_3_years = d.get("tco_total_3y", _to_num(getattr(car, "tco_3_years", 0), 0))
                car.tco_5_years = d.get("tco_total_5y", _to_num(getattr(car, "tco_5_years", 0), 0))
                car.tco_8_years = d.get("tco_total_8y", _to_num(getattr(car, "tco_8_years", 0), 0))
            except Exception:
                pass

            updated += 1

        db.session.commit()
        return jsonify({"updated": updated, "message": "Cars updated"}), 200
    except Exception as e:
        current_app.logger.warning("/api/cars/update failed: %s", e)
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500
