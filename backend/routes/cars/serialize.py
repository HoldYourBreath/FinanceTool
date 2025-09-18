# serialize.py
from __future__ import annotations
from typing import Dict, Any, Optional
from decimal import Decimal
from flask import current_app

from backend.models.models import Car, PriceSettings
from .pricing import normalize_prices, amortized_totals


def _f(x) -> float:
    if x is None:
        return 0.0
    if isinstance(x, Decimal):
        return float(x)
    try:
        return float(x)
    except Exception:
        try:
            return float(str(x).replace(",", "."))
        except Exception:
            return 0.0


def _text(x) -> Optional[str]:
    if x is None:
        return None
    try:
        # enums -> string
        v = getattr(x, "value", None) or getattr(x, "name", None)
        return str(v) if v is not None else str(x)
    except Exception:
        return str(x)


# -------- energy / running cost helpers --------
def _energy_year(car: Car, P: Dict[str, Any]) -> float:
    tv = (_text(getattr(car, "type_of_vehicle", None)) or "EV").strip()
    kwh100 = _f(getattr(car, "consumption_kwh_per_100km", None))
    l100   = _f(getattr(car, "consumption_l_per_100km", None))
    km     = int(P.get("yearly_km", 18000))

    if tv == "EV":
        return (km / 100.0) * kwh100 * P["elec_sek_kwh"]
    if tv == "Diesel":
        return (km / 100.0) * l100 * P["diesel_sek_l"]
    if tv == "Bensin":
        return (km / 100.0) * l100 * P["bensin_sek_l"]
    if tv == "PHEV":
        # simple blended model (improve later if you like)
        return (km / 100.0) * (l100 * P["bensin_sek_l"] + kwh100 * P["elec_sek_kwh"])
    return 0.0


def _tires_year(car: Car, P: Dict[str, Any]) -> float:
    total = _f(getattr(car, "summer_tires_price", 0)) + _f(getattr(car, "winter_tires_price", 0))
    # prefer car-specific interval if present, else global from settings
    life = int(getattr(car, "tire_replacement_interval_years", 0) or 0)
    if life <= 0:
        life = int(P.get("tire_lifespan_years", 3)) or 3
    return (total / float(life)) if (total > 0 and life > 0) else 0.0


def _insurance_year(car: Car) -> float:
    full = _f(getattr(car, "full_insurance_year", 0))
    half = _f(getattr(car, "half_insurance_year", 0))
    return full if full > 0 else (half if half > 0 else 0.0)


def _recurring_year(car: Car, P: Dict[str, Any]) -> float:
    return (
        _energy_year(car, P)
        + _insurance_year(car)
        + _f(getattr(car, "car_tax_year", 0))
        + _f(getattr(car, "repairs_year", 0))
        + _tires_year(car, P)
    )


def _residuals(car: Car, purchase: float) -> Dict[str, float]:
    v3 = getattr(car, "expected_value_after_3y", None)
    v5 = getattr(car, "expected_value_after_5y", None)
    v8 = getattr(car, "expected_value_after_8y", None)

    # fallbacks: 45/60/75% depreciation
    if v3 is None: v3 = purchase * 0.55
    if v5 is None: v5 = purchase * 0.40
    if v8 is None: v8 = purchase * 0.25

    return dict(v3=_f(v3), v5=_f(v5), v8=_f(v8))


# -------- public: compute + serialize --------
def compute_derived(car: Car, ps: Optional[PriceSettings]) -> Dict[str, float]:
    """
    TCO model = Depreciation + Recurring + FinancingInterest
    (Downpayment is not added separately; it cancels with principal
    when you model total outflows vs residual. It *does* reduce interest.)
    """
    P = normalize_prices(ps)

    purchase = _f(getattr(car, "estimated_purchase_price", 0))
    energy_y = _energy_year(car, P)
    recurring_y = _recurring_year(car, P)
    res = _residuals(car, purchase)

    dep3 = max(0.0, purchase - res["v3"])
    dep5 = max(0.0, purchase - res["v5"])
    dep8 = max(0.0, purchase - res["v8"])

    # interest component over each horizon
    _, interest3 = amortized_totals(purchase, P["downpayment_sek"], P["interest_rate_pct"], 3)
    _, interest5 = amortized_totals(purchase, P["downpayment_sek"], P["interest_rate_pct"], 5)
    _, interest8 = amortized_totals(purchase, P["downpayment_sek"], P["interest_rate_pct"], 8)

    tco3 = dep3 + 3 * recurring_y + interest3
    tco5 = dep5 + 5 * recurring_y + interest5
    tco8 = dep8 + 8 * recurring_y + interest8

    return {
        "energy_fuel_year": round(energy_y, 2),
        "recurring_year": round(recurring_y, 2),

        "expected_value_after_3y": round(res["v3"], 2),
        "expected_value_after_5y": round(res["v5"], 2),
        "expected_value_after_8y": round(res["v8"], 2),

        "interest_3y": round(interest3, 2),
        "interest_5y": round(interest5, 2),
        "interest_8y": round(interest8, 2),

        "tco_total_3y": round(tco3, 2),
        "tco_total_5y": round(tco5, 2),
        "tco_total_8y": round(tco8, 2),

        # for back-compat with any old fields:
        "tco_3_years": round(tco3, 2),
        "tco_5_years": round(tco5, 2),
        "tco_8_years": round(tco8, 2),

        "tco_per_month_3y": round(tco3 / 36.0, 2),
        "tco_per_month_5y": round(tco5 / 60.0, 2),
        "tco_per_month_8y": round(tco8 / 96.0, 2),
    }


def serialize_car(c: Car, ps: Optional[PriceSettings]) -> Dict[str, Any]:
    """
    Raw car fields + derived numbers (financing-aware).
    """
    derived: Dict[str, Any] = {}
    try:
        derived = compute_derived(c, ps)
    except Exception as e:
        current_app.logger.debug("compute_derived failed for car %s: %s", getattr(c, "id", "?"), e)

    out: Dict[str, Any] = {
        "id": c.id,
        "model": _text(c.model) or "",
        "year": int(_f(c.year)) if c.year is not None else None,

        "type_of_vehicle": _text(getattr(c, "type_of_vehicle", None)) or "EV",
        "body_style": _text(getattr(c, "body_style", None)),
        "eu_segment": _text(getattr(c, "eu_segment", None)),
        "suv_tier": _text(getattr(c, "suv_tier", None)),

        "estimated_purchase_price": _f(getattr(c, "estimated_purchase_price", 0)),
        "summer_tires_price": _f(getattr(c, "summer_tires_price", 0)),
        "winter_tires_price": _f(getattr(c, "winter_tires_price", 0)),

        "full_insurance_year": _f(getattr(c, "full_insurance_year", 0)),
        "half_insurance_year": _f(getattr(c, "half_insurance_year", 0)),
        "car_tax_year": _f(getattr(c, "car_tax_year", 0)),
        "repairs_year": _f(getattr(c, "repairs_year", 0)),

        "consumption_kwh_per_100km": _f(getattr(c, "consumption_kwh_per_100km", 0)),
        "consumption_l_per_100km": _f(getattr(c, "consumption_l_per_100km", 0)),
        "battery_capacity_kwh": _f(getattr(c, "battery_capacity_kwh", 0)),
        "acceleration_0_100": _f(getattr(c, "acceleration_0_100", 0)),
        "range_km": int(_f(getattr(c, "range_km", 0))),
        "driven_km": int(_f(getattr(c, "driven_km", 0))),
        "battery_aviloo_score": int(_f(getattr(c, "battery_aviloo_score", 0))),
        "trunk_size_litre": int(_f(getattr(c, "trunk_size_litre", 0))),

        "dc_peak_kw": _f(getattr(c, "dc_peak_kw", 0)),
        "dc_time_min_10_80": int(_f(getattr(c, "dc_time_min_10_80", 0))),
        "dc_time_source": _text(getattr(c, "dc_time_source", None)),
        "ac_onboard_kw": _f(getattr(c, "ac_onboard_kw", 0)),
        "ac_time_h_0_100": _f(getattr(c, "ac_time_h_0_100", 0)),
        "ac_time_source": _text(getattr(c, "ac_time_source", None)),

        # keep persisted TCOs if you have them, but derived will overwrite
        "tco_3_years": _f(getattr(c, "tco_3_years", 0)),
        "tco_5_years": _f(getattr(c, "tco_5_years", 0)),
        "tco_8_years": _f(getattr(c, "tco_8_years", 0)),
    }

    out.update(derived)
    return out
