from __future__ import annotations

from .depreciation import (
    DepreciationParams,
    estimate_new_price_from_today_price,
    predict_future_value_from_today_price,
)
from .energy import energy_cost_per_month
from .format import to_num
from .settings import get_yearly_km


def compute_derived(car) -> dict:
    base = to_num(getattr(car, 'estimated_purchase_price', 0.0))  # today's price

    insurance_month = to_num(getattr(car, 'full_insurance_year', 0.0)) / 12.0
    car_tax_month = to_num(getattr(car, 'car_tax_year', 0.0)) / 12.0
    repairs_month = to_num(getattr(car, 'repairs_year', 0.0)) / 12.0

    tires_total = to_num(getattr(car, 'summer_tires_price', 0.0)) + to_num(
        getattr(car, 'winter_tires_price', 0.0)
    )

    energy_month = energy_cost_per_month(car)
    monthly_running_ex_tires = insurance_month + car_tax_month + repairs_month + energy_month

    yearly_km = get_yearly_km()
    params = DepreciationParams()

    new_price_est = estimate_new_price_from_today_price(
        today_price=base,
        car_year=int(getattr(car, 'year', 0) or 0),
        type_of_vehicle=getattr(car, 'type_of_vehicle', None),
        params=params,
    )

    depr_since_new = max(0.0, new_price_est - base)
    depr_since_new_pct = (depr_since_new / new_price_est) if new_price_est else 0.0
    out = {}
    for years in (3, 5, 8):
        months = years * 12

        expected_value = predict_future_value_from_today_price(
            today_price=base,
            car_year=int(getattr(car, 'year', 0) or 0),
            years_ahead=years,
            type_of_vehicle=getattr(car, 'type_of_vehicle', None),
            yearly_km_future=yearly_km,
            params=params,
        )
        depreciation_amount = max(0.0, base - expected_value)

        tires_per_month = (tires_total / months) if months else 0.0
        running_total = (monthly_running_ex_tires + tires_per_month) * months

        tco_total = running_total + depreciation_amount
        tco_per_month = (tco_total / months) if months else 0.0

        out[f'expected_value_after_{years}y'] = expected_value
        out[f'tco_total_{years}y'] = tco_total
        out[f'tco_per_month_{years}y'] = tco_per_month
        out['new_price_est'] = new_price_est
        out['depreciation_since_new_total'] = depr_since_new
        out['depreciation_since_new_pct'] = depr_since_new_pct  # 0–1; format as %

    return out
