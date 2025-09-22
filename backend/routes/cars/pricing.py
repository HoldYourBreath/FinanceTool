from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from backend.models.models import PriceSettings  # absolute import to avoid relative hops

from .util import num

DEFAULTS: Dict[str, Any] = {
    # prices
    "el_price_ore_kwh": 250,      # 2.50 SEK/kWh
    "diesel_sek_l": 20.0,
    "bensin_sek_l": 18.0,
    # driving
    "yearly_km": 18000,
    "daily_commute_km": 30,
    # charging system losses (applied to electricity price)
    "charging_loss_pct": 0.10,
    # tire replacement
    "tire_lifespan_years": 3,
    # financing
    "downpayment_sek": 100000.0,
    "interest_rate_pct": 5.0,
}


def _pos(v, fallback):
    x = num(v, None)
    return x if (x is not None and x > 0) else fallback


def normalize_prices(ps: Optional[PriceSettings]) -> Dict[str, Any]:
    """
    Convert a PriceSettings row into a normalized dict the calculators can use.
    Safe if ps is None (uses DEFAULTS).
    """
    if not ps:
        ore = DEFAULTS["el_price_ore_kwh"]
        loss = 1.0 + DEFAULTS["charging_loss_pct"]
        return {
            "elec_sek_kwh": (ore / 100.0) * loss,
            "diesel_sek_l": DEFAULTS["diesel_sek_l"],
            "bensin_sek_l": DEFAULTS["bensin_sek_l"],
            "yearly_km": DEFAULTS["yearly_km"],
            "daily_commute_km": DEFAULTS["daily_commute_km"],
            "tire_lifespan_years": DEFAULTS["tire_lifespan_years"],
            "downpayment_sek": DEFAULTS["downpayment_sek"],
            "interest_rate_pct": DEFAULTS["interest_rate_pct"],
        }

    ore = _pos(getattr(ps, "el_price_ore_kwh", None), DEFAULTS["el_price_ore_kwh"])
    loss_pct = getattr(ps, "charging_loss_pct", DEFAULTS["charging_loss_pct"]) or DEFAULTS["charging_loss_pct"]
    loss = 1.0 + float(loss_pct)

    return {
        "elec_sek_kwh": (ore / 100.0) * loss,
        "diesel_sek_l": _pos(getattr(ps, "diesel_price_sek_litre", None), DEFAULTS["diesel_sek_l"]),
        "bensin_sek_l": _pos(getattr(ps, "bensin_price_sek_litre", None), DEFAULTS["bensin_sek_l"]),
        "yearly_km": int(_pos(getattr(ps, "yearly_km", None), DEFAULTS["yearly_km"])),
        "daily_commute_km": int(_pos(getattr(ps, "daily_commute_km", None), DEFAULTS["daily_commute_km"])),
        "tire_lifespan_years": max(1, int(_pos(getattr(ps, "tire_lifespan_years", None), DEFAULTS["tire_lifespan_years"]))),
        "downpayment_sek": float(getattr(ps, "downpayment_sek", DEFAULTS["downpayment_sek"]) or 0.0),
        "interest_rate_pct": float(getattr(ps, "interest_rate_pct", DEFAULTS["interest_rate_pct"]) or 0.0),
    }


def amortized_totals(purchase_price: float, downpayment_sek: float, interest_rate_pct: float, years: int) -> Tuple[float, float]:
    """
    Return (total_paid_over_term, interest_paid_over_term) for a loan
    with principal (price - downpayment), annual rate %, and term years.
    """
    principal = max(float(purchase_price) - float(downpayment_sek), 0.0)
    n = max(int(years) * 12, 1)
    r_annual = max(float(interest_rate_pct), 0.0) / 100.0

    if principal <= 0:
        return (0.0, 0.0)

    if r_annual <= 0.0:
        monthly = principal / n
        total_paid = monthly * n
    else:
        r = r_annual / 12.0
        monthly = principal * (r / (1 - (1 + r) ** (-n)))
        total_paid = monthly * n

    interest_paid = total_paid - principal
    return (total_paid, interest_paid)
