# backend/utils/tco.py
from __future__ import annotations

from decimal import Decimal

from backend.models.models import PriceSettings


# ---------- numeric helpers ----------
def _f(x, default: float = 0.0) -> float:
    if x is None:
        return default
    if isinstance(x, Decimal):
        return float(x)
    try:
        return float(x)
    except Exception:
        try:
            return float(str(x).replace(",", "."))
        except Exception:
            return default


def _safe_int(x, default: int = 0) -> int:
    try:
        return int(_f(x, default))
    except Exception:
        return default


# ---------- settings ----------
def _prices() -> dict[str, float]:
    """
    Read PriceSettings(id=1) if available; otherwise return safe defaults.
    CI-safe: never raises on missing table/row.
    """
    ps: PriceSettings | None = None
    try:
        ps = PriceSettings.query.get(1)
    except Exception:
        ps = None

    # Defaults (match your other endpoints’ defaults)
    yearly_km = 18000
    el_price_ore_kwh = 250.0  # -> 2.50 SEK/kWh
    bensin_sek_l = 14.0
    diesel_sek_l = 15.0
    downpayment_sek = 0.0
    interest_rate_pct = 5.0

    if not ps:
        return dict(
            yearly_km=yearly_km,
            el_sek_kwh=el_price_ore_kwh / 100.0,
            bensin_sek_l=bensin_sek_l,
            diesel_sek_l=diesel_sek_l,
            downpayment_sek=downpayment_sek,
            interest_rate_pct=interest_rate_pct,
        )

    return dict(
        yearly_km=_safe_int(getattr(ps, "yearly_km", yearly_km), yearly_km),
        el_sek_kwh=_f(
            getattr(ps, "el_price_ore_kwh", el_price_ore_kwh), el_price_ore_kwh
        )
        / 100.0,
        bensin_sek_l=_f(
            getattr(ps, "bensin_price_sek_litre", bensin_sek_l), bensin_sek_l
        ),
        diesel_sek_l=_f(
            getattr(ps, "diesel_price_sek_litre", diesel_sek_l), diesel_sek_l
        ),
        downpayment_sek=_f(
            getattr(ps, "downpayment_sek", downpayment_sek), downpayment_sek
        ),
        interest_rate_pct=_f(
            getattr(ps, "interest_rate_pct", interest_rate_pct), interest_rate_pct
        ),
    )


# ---------- energy / recurring ----------
def _energy_year(car, P):
    tv = getattr(car, "type_of_vehicle", None) or "EV"
    kwh100 = _f(getattr(car, "consumption_kwh_per_100km", None))
    l100 = _f(getattr(car, "consumption_l_per_100km", None))
    km = P["yearly_km"]

    if tv == "EV":
        return (km / 100.0) * kwh100 * P["el_sek_kwh"]
    if tv == "Diesel":
        return (km / 100.0) * l100 * P["diesel_sek_l"]
    if tv == "Bensin":
        return (km / 100.0) * l100 * P["bensin_sek_l"]
    if tv == "PHEV":
        # simple split (if both provided just sum both parts)
        return (km / 100.0) * (l100 * P["bensin_sek_l"] + kwh100 * P["el_sek_kwh"])
    return 0.0


def _tires_year(car):
    # amortize summer + winter over 4 seasons (simple/tweakable)
    total = _f(getattr(car, "summer_tires_price", 0)) + _f(
        getattr(car, "winter_tires_price", 0)
    )
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


# ---------- depreciation via residuals ----------
def _residuals(car, purchase: float) -> dict[str, float]:
    # use explicit fields if your model has them; otherwise sensible defaults
    v3 = getattr(car, "expected_value_after_3y", None)
    v5 = getattr(car, "expected_value_after_5y", None)
    v8 = getattr(car, "expected_value_after_8y", None)

    if v3 is None:
        v3 = purchase * 0.55  # ~45% depreciation after 3y
    if v5 is None:
        v5 = purchase * 0.40  # ~60% after 5y
    if v8 is None:
        v8 = purchase * 0.25  # ~75% after 8y

    return dict(v3=_f(v3), v5=_f(v5), v8=_f(v8))


# ---------- financing ----------
def _amortized_totals(
    principal: float, interest_rate_pct: float, years: int
) -> tuple[float, float]:
    """
    Return (total_paid_over_term, interest_paid_over_term) for a standard
    annuity loan:
      principal = financed amount
      interest_rate_pct = nominal APR in percent
      years = term
    """
    principal = max(float(principal), 0.0)
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


# ---------- public: compute derived ----------
def compute_derived(car) -> dict[str, float]:
    """
    Returns a dict with (now financing-aware):
      energy_fuel_year, energy_cost_month,
      recurring_year,
      expected_value_after_3y/5y/8y,
      finance_downpayment_sek, finance_principal_sek,
      finance_interest_cost_3y/5y/8y,
      tco_total_3y/5y/8y (+ aliases tco_3_years/5_years/8_years),
      tco_per_month_3y/5y/8y
    """
    P = _prices()

    purchase = _f(getattr(car, "estimated_purchase_price", 0))
    down = max(0.0, _f(P.get("downpayment_sek", 0.0)))
    rate_pct = max(0.0, _f(P.get("interest_rate_pct", 0.0)))
    principal = max(0.0, purchase - down)

    energy_y = _energy_year(car, P)
    recurring_y = _recurring_year(car, P)
    res = _residuals(car, purchase)

    dep3 = max(0.0, purchase - res["v3"])
    dep5 = max(0.0, purchase - res["v5"])
    dep8 = max(0.0, purchase - res["v8"])

    # interest over each horizon for the financed part (principal)
    _, i3 = _amortized_totals(principal, rate_pct, 3)
    _, i5 = _amortized_totals(principal, rate_pct, 5)
    _, i8 = _amortized_totals(principal, rate_pct, 8)

    # TCO = depreciation + recurring + (financing interest)
    tco3 = dep3 + 3 * recurring_y + i3
    tco5 = dep5 + 5 * recurring_y + i5
    tco8 = dep8 + 8 * recurring_y + i8

    return {
        # energy / recurring
        "energy_fuel_year": round(energy_y),
        "energy_cost_month": round(energy_y / 12.0, 2),
        "recurring_year": round(recurring_y),
        # residuals
        "expected_value_after_3y": round(res["v3"]),
        "expected_value_after_5y": round(res["v5"]),
        "expected_value_after_8y": round(res["v8"]),
        # financing diagnostics
        "finance_downpayment_sek": round(down, 2),
        "finance_principal_sek": round(principal, 2),
        "finance_interest_cost_3y": round(i3, 2),
        "finance_interest_cost_5y": round(i5, 2),
        "finance_interest_cost_8y": round(i8, 2),
        # totals (include interest)
        "tco_total_3y": round(tco3),
        "tco_total_5y": round(tco5),
        "tco_total_8y": round(tco8),
        # aliases your UI might already bind to
        "tco_3_years": round(tco3),
        "tco_5_years": round(tco5),
        "tco_8_years": round(tco8),
        # per-month helpers
        "tco_per_month_3y": round(tco3 / 36),
        "tco_per_month_5y": round(tco5 / 60),
        "tco_per_month_8y": round(tco8 / 96),
    }
