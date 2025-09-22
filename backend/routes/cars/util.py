from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any


def as_text(v: Any, default: str | None = None) -> str | None:
    if v is None:
        return default
    try:
        if isinstance(v, Enum):
            v = getattr(v, "value", None) or getattr(v, "name", None)
    except Exception:
        pass
    try:
        return str(v)
    except Exception:
        return default


def plainify(v: Any):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, Enum):
        return getattr(v, "value", None) or getattr(v, "name", None)
    return v


def as_float(v: Any, default: float | None = None) -> float | None:
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


def num(v: Any, default: float = 0.0) -> float:
    out = as_float(v, None)
    return out if out is not None and out == out else default  # NaN-safe


def safe(val, default=None):
    return val if val is not None else default


def norm_type(type_str: str) -> str:
    s = (type_str or "").strip().lower()
    if s in {"bev", "electric", "ev"}:
        return "EV"
    if "plug" in s or s == "phev":
        return "PHEV"
    if s.startswith("d"):
        return "Diesel"
    if s.startswith("b") or "petrol" in s or "gasoline" in s:
        return "Bensin"
    return s.upper() if s else "EV"


def estimate_full_insurance_year(price: float, norm_type_: str) -> float:
    if price <= 0:
        return 11000 if norm_type_ == "EV" else 12000
    base = 4000 if norm_type_ == "EV" else 5000
    rate = 0.020 if norm_type_ == "EV" else 0.022
    full = base + rate * price
    return max(7000, min(15000, full))


def estimate_half_from_full(full: float) -> float:
    return round(full * 0.55)


def estimate_tax_year(norm_type_: str) -> float:
    return 360 if norm_type_ == "EV" else 1600


def estimate_repairs_year(norm_type_: str, car_year: int | None) -> float:
    year_now = datetime.utcnow().year
    age = max(0, (year_now - int(car_year)) if car_year else 0)
    base = 3000 if norm_type_ == "EV" else 5000
    return base + max(0, age - 5) * 300


# Optional charging fallbacks (if you render these fields)
try:
    from utils.charging import estimate_ac_0_100_hours, estimate_dc_10_80_minutes
except Exception:  # pragma: no cover
    def estimate_dc_10_80_minutes(batt_kwh, peak_kw) -> int:
        try:
            batt = float(batt_kwh or 0)
            peak = float(peak_kw or 0)
            if batt <= 0 or peak <= 0:
                return 0
            return int(round((0.7 * batt) / (0.6 * peak) * 60))  # simple heuristic
        except Exception:
            return 0

    def estimate_ac_0_100_hours(batt_kwh, ac_kw) -> float:
        try:
            batt = float(batt_kwh or 0)
            ac = float(ac_kw or 0) or 7.0
            return round(batt / ac, 1) if batt > 0 else 0.0
        except Exception:
            return 0.0
