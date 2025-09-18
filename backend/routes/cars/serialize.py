from __future__ import annotations
from typing import Optional, Dict, Any

from backend.models.models import Car, PriceSettings
from .util import (
    as_text, plainify, as_float, num, safe, norm_type,
    estimate_full_insurance_year, estimate_half_from_full,
    estimate_tax_year, estimate_repairs_year,
    estimate_ac_0_100_hours, estimate_dc_10_80_minutes
)
from .pricing import normalize_prices, amortized_totals


def _get_model_range_val(c: Car) -> Optional[float]:
    if hasattr(c, "range_km") and c.range_km is not None:
        return as_float(c.range_km)
    return as_float(getattr(c, "range_km", None))


def _yearly_energy_cost(car: Car, P: Dict[str, Any]) -> float:
    yearly_km = P["yearly_km"]
    kwh100 = num(getattr(car, "consumption_kwh_per_100km", None), 0.0)
    l100 = num(getattr(car, "consumption_l_per_100km", None), 0.0)
    t = norm_type(as_text(safe(car.type_of_vehicle, "EV")))

    if t == "EV":
        return (yearly_km / 100.0) * kwh100 * P["elec_sek_kwh"]
    if t == "Diesel":
        return (yearly_km / 100.0) * l100 * P["diesel_sek_l"]
    if t == "Bensin":
        return (yearly_km / 100.0) * l100 * P["bensin_sek_l"]
    if t == "PHEV":
        batt_kwh = num(getattr(car, "battery_capacity_kwh", None), 0.0)
        ev_range = (100.0 * batt_kwh / kwh100) if (batt_kwh > 0 and kwh100 > 0) else 40.0
        ev_km_day = min(P["daily_commute_km"], ev_range)
        ev_share = min(1.0, max(0.0, (ev_km_day * 22.0) / yearly_km)) if yearly_km > 0 else 0.6
        ev_part = ev_share * kwh100 * P["elec_sek_kwh"]
        ice_part = (1.0 - ev_share) * l100 * P["bensin_sek_l"]
        return (yearly_km / 100.0) * (ev_part + ice_part)

    return 0.0


def _yearly_fixed_costs(car: Car, P: Dict[str, Any]) -> Dict[str, float]:
    tires_year = (num(car.summer_tires_price, 0) + num(car.winter_tires_price, 0)) / float(P["tire_lifespan_years"])

    t = norm_type(as_text(safe(car.type_of_vehicle, "EV")))
    price = num(getattr(car, "estimated_purchase_price", None), 0)

    full_raw = num(getattr(car, "full_insurance_year", None), 0)
    half_raw = num(getattr(car, "half_insurance_year", None), 0)
    if full_raw > 0:
        full_eff = full_raw
    elif half_raw > 0:
        full_eff = half_raw / 0.55
    else:
        full_eff = estimate_full_insurance_year(price, t)

    tax_raw = num(getattr(car, "car_tax_year", None), 0)
    tax_eff = tax_raw if tax_raw > 0 else estimate_tax_year(t)

    repairs_raw = num(getattr(car, "repairs_year", None), 0)
    repairs_eff = repairs_raw if repairs_raw > 0 else estimate_repairs_year(t, getattr(car, "year", None))

    return {
        "tires_year_effective": round(tires_year, 2),
        "full_insurance_year_effective": round(full_eff, 2),
        "half_insurance_year_effective": round(estimate_half_from_full(full_eff), 2),
        "car_tax_year_effective": round(tax_eff, 2),
        "repairs_year_effective": round(repairs_eff, 2),
        "recurring_per_year": round(tires_year + full_eff + tax_eff + repairs_eff, 2),
    }


def _tco_financed(car: Car, P: Dict[str, Any], years: int) -> float:
    """
    TCO = downpayment (cash) + sum(monthly loan payments over horizon)
          + (yearly energy + yearly fixed) * years
    """
    purchase_price = num(getattr(car, "estimated_purchase_price", None), 0.0)
    downpayment = float(P.get("downpayment_sek", 0.0) or 0.0)
    rate_pct = float(P.get("interest_rate_pct", 0.0) or 0.0)

    total_paid, _interest = amortized_totals(purchase_price, downpayment, rate_pct, years)
    cash_for_car = min(downpayment, purchase_price) + total_paid

    energy_year = _yearly_energy_cost(car, P)
    fixed = _yearly_fixed_costs(car, P)
    recurring_year = energy_year + fixed["recurring_per_year"]

    return round(cash_for_car + years * recurring_year, 2)


def compute_derived(car: Car, ps: Optional[PriceSettings]) -> Dict[str, Any]:
    P = normalize_prices(ps)

    energy_year = _yearly_energy_cost(car, P)
    fixed = _yearly_fixed_costs(car, P)

    d = {
        "energy_cost_month": round(energy_year / 12.0, 2),
        "recurring_per_year": round(fixed["recurring_per_year"] + energy_year, 2),
        "tco_3_years": _tco_financed(car, P, 3),
        "tco_5_years": _tco_financed(car, P, 5),
        "tco_8_years": _tco_financed(car, P, 8),
        # legacy aliases kept
        "tco_total_3y": _tco_financed(car, P, 3),
        "tco_total_5y": _tco_financed(car, P, 5),
        "tco_total_8y": _tco_financed(car, P, 8),
        # expose effective components
        **fixed,
    }

    # Optional charge-time derivations if you want to ensure presence
    batt = num(getattr(car, "battery_capacity_kwh", None), 0.0)
    ac_kw = num(getattr(car, "ac_onboard_kw", None), 0.0)
    dc_kw = num(getattr(car, "dc_peak_kw", None), 0.0)

    d.setdefault("ac_time_h_0_100", num(getattr(car, "ac_time_h_0_100", None), estimate_ac_0_100_hours(batt, ac_kw)))
    d.setdefault("dc_time_min_10_80", num(getattr(car, "dc_time_min_10_80", None), estimate_dc_10_80_minutes(batt, dc_kw)))

    return d


def serialize_car(c: Car, ps: Optional[PriceSettings]) -> Dict[str, Any]:
    derived = {}
    try:
        derived = compute_derived(c, ps)
    except Exception:
        derived = {}

    full_raw = as_float(getattr(c, "full_insurance_year", None))
    half_raw = as_float(getattr(c, "half_insurance_year", None))
    tax_raw = as_float(getattr(c, "car_tax_year", None))
    repairs_raw = as_float(getattr(c, "repairs_year", None))

    d = {
        "id": c.id,
        "model": as_text(c.model, ""),
        "year": int(num(c.year, 0)) if c.year is not None else None,
        "type_of_vehicle": norm_type(as_text(safe(c.type_of_vehicle, "EV"))),
        "body_style": as_text(getattr(c, "body_style", None)),
        "eu_segment": as_text(getattr(c, "eu_segment", None)),
        "suv_tier": as_text(getattr(c, "suv_tier", None)),
        "estimated_purchase_price": as_float(c.estimated_purchase_price),

        "summer_tires_price": as_float(c.summer_tires_price),
        "winter_tires_price": as_float(c.winter_tires_price),

        # EFFECTIVE display values merged in from derived
        "full_insurance_year": derived.get("full_insurance_year_effective"),
        "half_insurance_year": derived.get("half_insurance_year_effective"),
        "car_tax_year": derived.get("car_tax_year_effective"),
        "repairs_year": derived.get("repairs_year_effective"),

        # raw mirrors
        "full_insurance_year_raw": full_raw,
        "half_insurance_year_raw": half_raw,
        "car_tax_year_raw": tax_raw,
        "repairs_year_raw": repairs_raw,

        # aliases
        "fullInsuranceYear": derived.get("full_insurance_year_effective"),
        "halfInsuranceYear": derived.get("half_insurance_year_effective"),
        "carTaxYear": derived.get("car_tax_year_effective"),
        "repairsYear": derived.get("repairs_year_effective"),

        # consumption/spec
        "consumption_kwh_100km": as_float(c.consumption_kwh_per_100km),
        "consumption_kwh_per_100km": as_float(c.consumption_kwh_per_100km),
        "consumption_l_per_100km": as_float(getattr(c, "consumption_l_per_100km", None)),
        "range_km": _get_model_range_val(c),
        "acceleration_0_100": as_float(c.acceleration_0_100),
        "battery_capacity_kwh": as_float(c.battery_capacity_kwh),
        "trunk_size_litre": as_float(c.trunk_size_litre),

        # charging
        "dc_peak_kw": as_float(getattr(c, "dc_peak_kw", None)),
        "dc_time_min_10_80": as_float(getattr(c, "dc_time_min_10_80", None)),
        "dc_time_source": as_text(safe(getattr(c, "dc_time_source", ""), "")) or "",
        "ac_onboard_kw": as_float(getattr(c, "ac_onboard_kw", None)),
        "ac_time_h_0_100": as_float(getattr(c, "ac_time_h_0_100", None)),
        "ac_time_source": as_text(safe(getattr(c, "ac_time_source", ""), "")) or "",

        # persisted totals if any (before override by derived)
        "tco_3_years": as_float(getattr(c, "tco_3_years", None)),
        "tco_5_years": as_float(getattr(c, "tco_5_years", None)),
        "tco_8_years": as_float(getattr(c, "tco_8_years", None)),
        "tco_total_3y": as_float(getattr(c, "tco_total_3y", None)),
        "tco_total_5y": as_float(getattr(c, "tco_total_5y", None)),
        "tco_total_8y": as_float(getattr(c, "tco_total_8y", None)),
    }

    # merge derived (overrides TCO etc.)
    d.update(derived)
    return {k: plainify(v) for k, v in d.items()}
