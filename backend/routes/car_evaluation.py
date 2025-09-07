# routes/car_evaluation.py
from __future__ import annotations

from decimal import Decimal
from typing import Optional
from datetime import datetime

from flask import Blueprint, jsonify, request, current_app
from ..models.models import Car, PriceSettings, db

cars_bp = Blueprint("cars", __name__, url_prefix="/api")

# -------------------- Fallback estimators (safe if utils/* missing) --------------------
try:
    from utils.charging import estimate_ac_0_100_hours, estimate_dc_10_80_minutes
except Exception:  # pragma: no cover
    def estimate_dc_10_80_minutes(batt_kwh, peak_kw) -> int:
        try:
            batt = float(batt_kwh or 0)
            peak = float(peak_kw or 0)
            if batt <= 0 or peak <= 0:
                return 0
            return int(round((0.7 * batt) / (0.6 * peak) * 60))  # simple 10→80% heuristic
        except Exception:
            return 0

    def estimate_ac_0_100_hours(batt_kwh, ac_kw) -> float:
        try:
            batt = float(batt_kwh or 0)
            ac = float(ac_kw or 0) or 7.0
            return round(batt / ac, 1) if batt > 0 else 0.0
        except Exception:
            return 0.0


# -------------------- number helpers --------------------
def _as_float(v, default: Optional[float] = None) -> Optional[float]:
    """Decimal-safe float conversion. Returns default (None) instead of forcing 0."""
    if v is None:
        return default
    if isinstance(v, Decimal):
        return float(v)
    try:
        return float(v)
    except Exception:
        try:
            return float(str(v).replace(",", "."))
        except Exception:
            return default


def _num(v, default: float = 0.0) -> float:
    out = _as_float(v, None)
    return out if out is not None and out == out else default  # NaN guard


def _safe(val, default=None):
    return val if val is not None else default


def _parse_csv(name: str):
    raw = request.args.get(name)
    if not raw:
        return None
    return [v.strip() for v in raw.split(",") if v.strip()]


def _norm_type(t: str) -> str:
    s = (t or "").strip().lower()
    if s in {"bev", "electric", "ev"}:
        return "EV"
    if "plug" in s or s == "phev":
        return "PHEV"
    if s.startswith("d"):
        return "Diesel"
    if s.startswith("b") or "petrol" in s or "gasoline" in s:
        return "Bensin"
    return s.upper() if s else "EV"


# -------------------- pricing / TCO --------------------
def _pos(v, fallback):
    x = _num(v, None)
    return x if (x is not None and x > 0) else fallback


def _normalize_prices(ps: Optional[PriceSettings]) -> dict:
    DEFAULTS = {
        "elec_sek_kwh": 2.5 * 1.10,  # 250 öre → 2.50 SEK, +10% loss
        "diesel_sek_l": 20.0,
        "bensin_sek_l": 18.0,
        "yearly_km": 18000,
        "daily_commute_km": 30,
        "charging_loss_pct": 0.10,
        "tire_lifespan_years": 3,
        "dep3": 0.45,
        "dep5": 0.60,
        "dep8": 0.75,
    }
    if not ps:
        return DEFAULTS

    ore = _pos(getattr(ps, "el_price_ore_kwh", None), 250.0)
    loss = 1.0 + _pos(getattr(ps, "charging_loss_pct", None), DEFAULTS["charging_loss_pct"])
    elec_sek_kwh = (ore / 100.0) * loss

    return {
        "elec_sek_kwh": elec_sek_kwh,
        "diesel_sek_l": _pos(getattr(ps, "diesel_price_sek_litre", None), DEFAULTS["diesel_sek_l"]),
        "bensin_sek_l": _pos(getattr(ps, "bensin_price_sek_litre", None), DEFAULTS["bensin_sek_l"]),
        "yearly_km": int(_pos(getattr(ps, "yearly_km", None), DEFAULTS["yearly_km"])),
        "daily_commute_km": int(_pos(getattr(ps, "daily_commute_km", None), DEFAULTS["daily_commute_km"])),
        "charging_loss_pct": _pos(getattr(ps, "charging_loss_pct", None), DEFAULTS["charging_loss_pct"]),
        "tire_lifespan_years": max(1, int(_pos(getattr(ps, "tire_lifespan_years", None), DEFAULTS["tire_lifespan_years"]))),
        "dep3": _pos(getattr(ps, "dep3yPct", None), DEFAULTS["dep3"]),
        "dep5": _pos(getattr(ps, "dep5yPct", None), DEFAULTS["dep5"]),
        "dep8": _pos(getattr(ps, "dep8yPct", None), DEFAULTS["dep8"]),
    }


# --------- yearly fixed-cost estimators (used when DB has 0/NULL) ----------
def _estimate_full_insurance_year(car: Car, type_: str) -> float:
    price = _num(getattr(car, "estimated_purchase_price", None), 0)
    if price <= 0:
        return 11000 if type_ == "EV" else 12000
    base = 4000 if type_ == "EV" else 5000
    rate = 0.020 if type_ == "EV" else 0.022
    full = base + rate * price
    return max(7000, min(15000, full))


def _estimate_half_from_full(full: float) -> float:
    return round(full * 0.55)


def _estimate_tax_year(type_: str) -> float:
    return 360 if type_ == "EV" else 1600


def _estimate_repairs_year(type_: str, car_year: Optional[int]) -> float:
    year_now = datetime.utcnow().year
    age = max(0, (year_now - int(car_year)) if car_year else 0)
    base = 3000 if type_ == "EV" else 5000
    return base + max(0, age - 5) * 300


def _compute_derived(car: Car, ps: Optional[PriceSettings]) -> dict:
    P = _normalize_prices(ps)

    yearly_km = P["yearly_km"]
    type_ = _norm_type(_safe(car.type_of_vehicle, "EV"))

    kwh100 = _num(getattr(car, "consumption_kwh_per_100km", None), 0.0)
    l100 = _num(getattr(car, "consumption_l_per_100km", None), 0.0)

    # energy/year
    if type_ == "EV":
        energy_year = (yearly_km / 100.0) * kwh100 * P["elec_sek_kwh"]
    elif type_ == "Diesel":
        energy_year = (yearly_km / 100.0) * l100 * P["diesel_sek_l"]
    elif type_ == "Bensin":
        energy_year = (yearly_km / 100.0) * l100 * P["bensin_sek_l"]
    elif type_ == "PHEV":
        batt_kwh = _num(getattr(car, "battery_capacity_kwh", None), 0.0)
        ev_range = (100.0 * batt_kwh / kwh100) if (batt_kwh > 0 and kwh100 > 0) else 40.0
        ev_km_day = min(P["daily_commute_km"], ev_range)
        ev_share = min(1.0, max(0.0, (ev_km_day * 22.0) / yearly_km)) if yearly_km > 0 else 0.6
        ev_part = ev_share * kwh100 * P["elec_sek_kwh"]
        ice_part = (1.0 - ev_share) * l100 * P["bensin_sek_l"]
        energy_year = (yearly_km / 100.0) * (ev_part + ice_part)
    else:
        energy_year = 0.0

    # recurring/year (with fallbacks)
    tires_year = (_num(car.summer_tires_price, 0) + _num(car.winter_tires_price, 0)) / P["tire_lifespan_years"]

    full_ins_raw = _num(getattr(car, "full_insurance_year", None), 0)
    half_ins_raw = _num(getattr(car, "half_insurance_year", None), 0)

    if full_ins_raw > 0:
        full_ins_eff = full_ins_raw
    elif half_ins_raw > 0:
        full_ins_eff = half_ins_raw / 0.55
    else:
        full_ins_eff = _estimate_full_insurance_year(car, type_)

    tax_raw = _num(getattr(car, "car_tax_year", None), 0)
    tax_eff = tax_raw if tax_raw > 0 else _estimate_tax_year(type_)

    repairs_raw = _num(getattr(car, "repairs_year", None), 0)
    repairs_eff = repairs_raw if repairs_raw > 0 else _estimate_repairs_year(type_, getattr(car, "year", None))

    recurring_year = energy_year + tires_year + full_ins_eff + tax_eff + repairs_eff

    # depreciation
    price = _num(getattr(car, "estimated_purchase_price", None), 0)
    dep3 = price * P["dep3"]
    dep5 = price * P["dep5"]
    dep8 = price * P["dep8"]

    return {
        "energy_cost_month": round(energy_year / 12.0, 2),
        "recurring_per_year": round(recurring_year, 2),
        "tco_3_years": round(dep3 + 3 * recurring_year, 2),
        "tco_5_years": round(dep5 + 5 * recurring_year, 2),
        "tco_8_years": round(dep8 + 8 * recurring_year, 2),
        # legacy aliases
        "tco_total_3y": round(dep3 + 3 * recurring_year, 2),
        "tco_total_5y": round(dep5 + 5 * recurring_year, 2),
        "tco_total_8y": round(dep8 + 8 * recurring_year, 2),
        # expose the effective yearly costs we just used (for the UI)
        "full_insurance_year_effective": round(full_ins_eff, 2),
        "car_tax_year_effective": round(tax_eff, 2),
        "repairs_year_effective": round(repairs_eff, 2),
        "half_insurance_year_effective": round(_estimate_half_from_full(full_ins_eff), 2),
    }


# -------------------- serialization --------------------
def _serialize_car(c: Car, ps: Optional[PriceSettings]) -> dict:
    """Serialize with *effective* yearly cost fields (fallbacks applied) + raw mirrors."""
    # compute derived first so we can reuse the effective yearly costs
    derived = {}
    try:
        derived = _compute_derived(c, ps)
    except Exception as e:
        current_app.logger.debug("compute_derived failed for car %s: %s", c.id, e)

    # RAW values from DB
    full_raw = _as_float(getattr(c, "full_insurance_year", None))
    half_raw = _as_float(getattr(c, "half_insurance_year", None))
    tax_raw = _as_float(getattr(c, "car_tax_year", None))
    repairs_raw = _as_float(getattr(c, "repairs_year", None))

    # EFFECTIVE values (used for display)
    full_eff = derived.get("full_insurance_year_effective")
    half_eff = derived.get("half_insurance_year_effective")
    tax_eff = derived.get("car_tax_year_effective")
    repairs_eff = derived.get("repairs_year_effective")

    d = {
        "id": c.id,
        "model": c.model,
        "year": int(_num(c.year, 0)) if c.year is not None else None,
        "type_of_vehicle": _safe(c.type_of_vehicle, "EV"),

        # categories
        "body_style": c.body_style,
        "eu_segment": c.eu_segment,
        "suv_tier": c.suv_tier,

        # pricing/specs
        "estimated_purchase_price": _as_float(c.estimated_purchase_price),
        "summer_tires_price": _as_float(c.summer_tires_price),
        "winter_tires_price": _as_float(c.winter_tires_price),

        # yearly running-cost fields — return EFFECTIVE (non-zero) values for display
        "full_insurance_year": full_eff,
        "half_insurance_year": half_eff,
        "car_tax_year":        tax_eff,
        "repairs_year":        repairs_eff,

        # also include RAW mirrors (if you need the exact DB content)
        "full_insurance_year_raw": full_raw,
        "half_insurance_year_raw": half_raw,
        "car_tax_year_raw":        tax_raw,
        "repairs_year_raw":        repairs_raw,

        # camelCase aliases (in case the UI binds to these)
        "fullInsuranceYear": full_eff,
        "halfInsuranceYear": half_eff,
        "carTaxYear":        tax_eff,
        "repairsYear":       repairs_eff,

        # consumption/spec
        "consumption_kwh_100km":     _as_float(c.consumption_kwh_per_100km),
        "consumption_kwh_per_100km": _as_float(c.consumption_kwh_per_100km),
        "consumption_l_per_100km":   _as_float(getattr(c, "consumption_l_per_100km", None)),
        "range":                     _as_float(getattr(c, "range_km", None)),
        "acceleration_0_100":        _as_float(c.acceleration_0_100),
        "battery_capacity_kwh":      _as_float(c.battery_capacity_kwh),
        "trunk_size_litre":          _as_float(c.trunk_size_litre),

        # charging
        "dc_peak_kw":            _as_float(getattr(c, "dc_peak_kw", None)),
        "dc_time_min_10_80":     _as_float(getattr(c, "dc_time_min_10_80", None)),
        "dc_time_min_10_80_est": _as_float(getattr(c, "dc_time_min_10_80_est", None)),
        "dc_time_source":        _safe(getattr(c, "dc_time_source", ""), "") or "",
        "ac_onboard_kw":         _as_float(getattr(c, "ac_onboard_kw", None)),
        "ac_time_h_0_100":       _as_float(getattr(c, "ac_time_h_0_100", None)),
        "ac_time_h_0_100_est":   _as_float(getattr(c, "ac_time_h_0_100_est", None)),
        "ac_time_source":        _safe(getattr(c, "ac_time_source", ""), "") or "",

        # persisted totals if any (kept)
        "tco_3_years":  _as_float(getattr(c, "tco_3_years", None)),
        "tco_5_years":  _as_float(getattr(c, "tco_5_years", None)),
        "tco_8_years":  _as_float(getattr(c, "tco_8_years", None)),
        "tco_total_3y": _as_float(getattr(c, "tco_total_3y", None)),
        "tco_total_5y": _as_float(getattr(c, "tco_total_5y", None)),
        "tco_total_8y": _as_float(getattr(c, "tco_total_8y", None)),
    }

    # ensure estimates are present when explicit times are missing
    if _as_float(d.get("dc_time_min_10_80")) in (None, 0):
        d["dc_time_min_10_80_est"] = d.get("dc_time_min_10_80_est") or estimate_dc_10_80_minutes(
            d.get("battery_capacity_kwh", 0), d.get("dc_peak_kw", 0)
        )
    if _as_float(d.get("ac_time_h_0_100")) in (None, 0):
        d["ac_time_h_0_100_est"] = d.get("ac_time_h_0_100_est") or estimate_ac_0_100_hours(
            d.get("battery_capacity_kwh", 0), d.get("ac_onboard_kw", 0)
        )

    # finally merge in the rest of the derived metrics (energy/tco/etc.)
    d.update(derived)
    return d


@cars_bp.get("/cars/_which")
def which_handler():
    return {"handler": "car_evaluation"}


# -------------------- GET /api/cars --------------------
@cars_bp.get("/cars")
def get_cars():
    try:
        ps = PriceSettings.query.get(1)
        if not ps:
            ps = PriceSettings(id=1)
            db.session.add(ps)
            db.session.commit()

        q = Car.query

        body_styles = _parse_csv("body_style")
        segments = _parse_csv("eu_segment")
        suv_tiers = _parse_csv("suv_tier")
        veh_types = _parse_csv("type_of_vehicle")

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
        current_app.logger.info("/api/cars -> %d rows", len(cars))
        resp = jsonify([_serialize_car(c, ps) for c in cars])
        resp.headers["X-Cars-Handler"] = "car_evaluation"
        return resp, 200
    except Exception as e:
        current_app.logger.warning("GET /api/cars failed, returning []: %s", e)
        resp = jsonify([])
        resp.headers["X-Cars-Handler"] = "car_evaluation"
        return resp, 200


# -------------------- GET /api/cars/categories --------------------
@cars_bp.get("/cars/categories")
def car_categories():
    try:
        body_styles = [r[0] for r in db.session.query(Car.body_style).distinct() if r[0]]
        eu_segments = [r[0] for r in db.session.query(Car.eu_segment).distinct() if r[0]]
        suv_tiers = [r[0] for r in db.session.query(Car.suv_tier).distinct() if r[0]]
        resp = jsonify(
            {
                "body_styles": sorted(set(body_styles)),
                "eu_segments": sorted(set(eu_segments)),
                "suv_tiers": sorted(set(suv_tiers)),
            }
        )
        resp.headers["X-Cars-Handler"] = "car_evaluation"
        return resp, 200
    except Exception as e:
        current_app.logger.warning("GET /api/cars/categories failed, returning empty sets: %s", e)
        resp = jsonify({"body_styles": [], "eu_segments": [], "suv_tiers": []})
        resp.headers["X-Cars-Handler"] = "car_evaluation"
        return resp, 200


# -------------------- POST /api/cars/update --------------------
@cars_bp.post("/cars/update")
def update_cars():
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, list):
            return jsonify({"error": "Expected a JSON list"}), 400

        ps = PriceSettings.query.get(1)
        if not ps:
            ps = PriceSettings(id=1)
            db.session.add(ps)
            db.session.commit()

        updated = 0
        for p in data:
            car = Car.query.get(p.get("id"))
            if not car:
                continue

            if "model" in p:
                car.model = p["model"] or car.model
            if "year" in p and p["year"] is not None:
                car.year = int(_num(p["year"], car.year or 0))
            if "type_of_vehicle" in p:
                car.type_of_vehicle = p["type_of_vehicle"] or car.type_of_vehicle

            for k in ("body_style", "eu_segment", "suv_tier"):
                if k in p:
                    setattr(car, k, p[k] or getattr(car, k))

            if "consumption_kwh_100km" in p or "consumption_kwh_per_100km" in p:
                raw = p.get("consumption_kwh_100km", p.get("consumption_kwh_per_100km"))
                car.consumption_kwh_per_100km = _num(raw, car.consumption_kwh_per_100km or 0)
            if "consumption_l_per_100km" in p:
                car.consumption_l_per_100km = _num(p["consumption_l_per_100km"], car.consumption_l_per_100km or 0)

            for k in (
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
                    setattr(car, k, _num(p[k], getattr(car, k) or 0))

            if "range" in p:
                car.range_km = int(_num(p["range"], car.range_km or 0))

            if "dc_time_source" in p:
                car.dc_time_source = p["dc_time_source"] or car.dc_time_source
            if "ac_time_source" in p:
                car.ac_time_source = p["ac_time_source"] or car.ac_time_source

            try:
                car.dc_time_min_10_80_est = estimate_dc_10_80_minutes(_num(car.battery_capacity_kwh), _num(car.dc_peak_kw))
                car.ac_time_h_0_100_est = estimate_ac_0_100_hours(_num(car.battery_capacity_kwh), _num(car.ac_onboard_kw))
            except Exception:
                pass

            try:
                d = _compute_derived(car, ps)
                car.tco_3_years = d["tco_3_years"]
                car.tco_5_years = d["tco_5_years"]
                car.tco_8_years = d["tco_8_years"]
            except Exception as e:
                current_app.logger.debug("persist TCO failed for car %s: %s", car.id, e)

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
