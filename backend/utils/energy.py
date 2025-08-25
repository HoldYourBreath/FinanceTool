from __future__ import annotations

from .format import to_num
from .settings import get_prices, get_yearly_km

DEFAULT_COMMUTE_DAYS_PER_MONTH = 22


def energy_cost_per_month(car) -> float:
    prices = get_prices()
    monthly_km = get_yearly_km() / 12.0
    vehicle_type = (getattr(car, 'type_of_vehicle', 'EV') or 'EV').strip().upper()

    # EV: electricity only
    if vehicle_type in ('EV', 'BEV', 'ELECTRIC'):
        kwh_per_month = (
            to_num(getattr(car, 'consumption_kwh_per_100km', 0.0)) / 100.0
        ) * monthly_km
        return kwh_per_month * prices['el_price_sek']

    # PHEV: split between EV commute and petrol
    if vehicle_type == 'PHEV':
        cons_kwh_100 = to_num(getattr(car, 'consumption_kwh_per_100km', 0.0))
        batt_kwh = to_num(getattr(car, 'battery_capacity_kwh', 0.0))
        assumed_ev_range_km = 40.0
        if cons_kwh_100 > 0 and batt_kwh > 0:
            ev_range_km = 100.0 * batt_kwh / cons_kwh_100
        else:
            ev_range_km = assumed_ev_range_km

        daily_commute_km = float(prices['daily_commute_km']) or 0.0
        commute_days = DEFAULT_COMMUTE_DAYS_PER_MONTH

        ev_km_per_day = min(daily_commute_km, ev_range_km)
        ev_km_month = min(ev_km_per_day * commute_days, monthly_km)

        kwh_per_km = (cons_kwh_100 / 100.0) if cons_kwh_100 else 0.0
        kwh_month = ev_km_month * kwh_per_km
        el_cost = kwh_month * prices['el_price_sek']

        l_per_100 = to_num(getattr(car, 'consumption_l_per_100km', 0.0))
        fuel_price = prices['bensin_price_sek_litre']
        fuel_km = max(monthly_km - ev_km_month, 0.0)
        litres = (l_per_100 / 100.0) * fuel_km
        fuel_cost = litres * fuel_price
        return el_cost + fuel_cost

    # ICE / HEV: liquid fuel only
    l_per_100 = to_num(getattr(car, 'consumption_l_per_100km', 0.0))
    litres_per_month = (l_per_100 / 100.0) * monthly_km
    price = (
        prices['diesel_price_sek_litre']
        if vehicle_type == 'DIESEL'
        else prices['bensin_price_sek_litre']
    )
    return litres_per_month * price
