# backend/utils/tco.py
from __future__ import annotations
from decimal import Decimal
from typing import Optional, Dict
from backend.models.models import PriceSettings

def _f(x):
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

def _prices():
    ps = PriceSettings.query.get(1)
    # defaults if seed missing
    return dict(
        yearly_km = int(ps.yearly_km if ps and ps.yearly_km is not None else 18000),
        el_sek_kwh = (_f(ps.el_price_ore_kwh)/100.0) if ps and ps.el_price_ore_kwh is not None else 2.50,
        bensin_sek_l = _f(ps.bensin_price_sek_litre if ps else 14.0),
        diesel_sek_l = _f(ps.diesel_price_sek_litre if ps else 15.0),
    )

def _energy_year(car, P):
    tv = (car.type_of_vehicle or "EV")
    kwh100 = _f(getattr(car, "consumption_kwh_per_100km", None))
    l100   = _f(getattr(car, "consumption_l_per_100km", None))
    km     = P["yearly_km"]

    if tv == "EV":
        return (km/100.0) * kwh100 * P["el_sek_kwh"]
    if tv == "Diesel":
        return (km/100.0) * l100 * P["diesel_sek_l"]
    if tv == "Bensin":
        return (km/100.0) * l100 * P["bensin_sek_l"]
    if tv == "PHEV":
        # simple split: add both parts if provided
        return (km/100.0) * (l100 * P["bensin_sek_l"] + kwh100 * P["el_sek_kwh"])
    return 0.0

def _tires_year(car):
    # amortize summer + winter over 4 seasons (tweakable)
    total = _f(getattr(car, "summer_tires_price", 0)) + _f(getattr(car, "winter_tires_price", 0))
    return total / 4.0 if total > 0 else 0.0

def _insurance_year(car):
    # prefer non-zero "full"; else "half"; else 0
    full = _f(getattr(car, "full_insurance_year", 0))
    half = _f(getattr(car, "half_insurance_year", 0))
    return full if full > 0 else half

def _recurring_year(car, P):
    return (
        _energy_year(car, P)
        + _insurance_year(car)
        + _f(getattr(car, "car_tax_year", 0))
        + _f(getattr(car, "repairs_year", 0))
        + _tires_year(car)
    )

def _residuals(car, purchase: float) -> Dict[str, float]:
    # use explicit fields if your model has them; otherwise sensible defaults
    v3 = getattr(car, "expected_value_after_3y", None)
    v5 = getattr(car, "expected_value_after_5y", None)
    v8 = getattr(car, "expected_value_after_8y", None)

    if v3 is None: v3 = purchase * 0.55   # ~45% depreciation after 3y
    if v5 is None: v5 = purchase * 0.40   # ~60% after 5y
    if v8 is None: v8 = purchase * 0.25   # ~75% after 8y

    return dict(v3=_f(v3), v5=_f(v5), v8=_f(v8))

def compute_derived(car) -> Dict[str, float]:
    """
    Returns a dict with:
      energy_fuel_year, recurring_year,
      expected_value_after_3y/5y/8y,
      tco_total_3y/5y/8y, tco_per_month_3y/5y/8y
    """
    P = _prices()

    purchase = _f(getattr(car, "estimated_purchase_price", 0))
    energy_y = _energy_year(car, P)
    recurring_y = _recurring_year(car, P)
    res = _residuals(car, purchase)

    dep3 = max(0.0, purchase - res["v3"])
    dep5 = max(0.0, purchase - res["v5"])
    dep8 = max(0.0, purchase - res["v8"])

    tco3 = dep3 + 3 * recurring_y
    tco5 = dep5 + 5 * recurring_y
    tco8 = dep8 + 8 * recurring_y

    return {
        "energy_fuel_year": round(energy_y),
        "recurring_year": round(recurring_y),
        "expected_value_after_3y": round(res["v3"]),
        "expected_value_after_5y": round(res["v5"]),
        "expected_value_after_8y": round(res["v8"]),
        "tco_total_3y": round(tco3),
        "tco_total_5y": round(tco5),
        "tco_total_8y": round(tco8),
        "tco_per_month_3y": round(tco3 / 36),
        "tco_per_month_5y": round(tco5 / 60),
        "tco_per_month_8y": round(tco8 / 96),
    }
