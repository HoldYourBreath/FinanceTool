
from __future__ import annotations
from models.models import PriceSettings, db

DEFAULTS = dict(
    el_price_ore_kwh=250,      # öre/kWh
    bensin_price_sek_litre=14,
    diesel_price_sek_litre=15,
    yearly_km=18000,
    daily_commute_km=30,
)

def _get_or_create_prices_row() -> PriceSettings:
    ps = PriceSettings.query.get(1)
    if not ps:
        ps = PriceSettings(id=1, **DEFAULTS)
        db.session.add(ps)
        db.session.commit()
    return ps

def get_prices() -> dict:
    ps = _get_or_create_prices_row()
    el_price_sek = (ps.el_price_ore_kwh or 0) / 100.0
    return {
        "el_price_sek": el_price_sek,
        "el_price_ore_kwh": int(ps.el_price_ore_kwh or DEFAULTS["el_price_ore_kwh"]),
        "diesel_price_sek_litre": float(ps.diesel_price_sek_litre or DEFAULTS["diesel_price_sek_litre"]),
        "bensin_price_sek_litre": float(ps.bensin_price_sek_litre or DEFAULTS["bensin_price_sek_litre"]),
        "yearly_km": int(ps.yearly_km or DEFAULTS["yearly_km"]),
        "daily_commute_km": int(ps.daily_commute_km or DEFAULTS["daily_commute_km"]),
    }

def get_yearly_km() -> int:
    return get_prices()["yearly_km"]
