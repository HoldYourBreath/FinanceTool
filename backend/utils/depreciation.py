
from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from .format import to_num

# Retained value vs NEW price at 36/60/96 months (EU/SE heuristics)
RETENTION = {
    "PETROL": {36: 0.53, 60: 0.40, 96: 0.28},
    "DIESEL": {36: 0.50, 60: 0.38, 96: 0.25},
    "HEV":    {36: 0.56, 60: 0.42, 96: 0.30},
    "PHEV":   {36: 0.49, 60: 0.36, 96: 0.26},
    "BEV":    {36: 0.42, 60: 0.32, 96: 0.24},
}

SALVAGE_FLOOR = 0.15              # minimum retained value vs NEW price
STD_KM_PER_YEAR = 20_000
MILEAGE_SLOPE_PER_10K = 0.01      # -1 pp per +10k km/year over standard
WARRANTY_MONTHS = 96
BEV_WARRANTY_KINK_PP = 0.03       # extra drop when crossing 8y for BEV/PHEV
TAIL_DECAY_PP_PER_YEAR = 0.015    # additional pp decay per year after last anchor

def estimate_new_price_from_today_price(
    *, today_price: float, car_year: int, type_of_vehicle: str | None,
    params: "DepreciationParams | None" = None, today: date | None = None
) -> float:
    params = params or DepreciationParams()   # <-- instantiate here
    key = vehicle_key(type_of_vehicle)
    grid = params.retention.get(key, RETENTION["PETROL"])
    now_m = months_since_year(int(to_num(car_year, 0)), today=today)
    r_now = _retention_at(grid, now_m)
    if r_now <= 0:
        return today_price
    return today_price / r_now


def _retention_at(grid: dict[int, float], months: int) -> float:
    """Retention vs NEW price at given age (months).
    - Interpolate from (0, 1.0) to first anchor to ensure fresh cars drop over 3y.
    - Between anchors: linear interpolation.
    - Beyond last anchor: apply a gentle tail decay until the salvage floor.
    """
    # Sorted anchors
    anchors = sorted(grid.items())
    # Prepend baseline (0, 1.0) if not present
    if anchors[0][0] != 0:
        anchors = [(0, 1.0)] + anchors

    # Before/at first anchor
    if months <= anchors[1][0]:
        m0, r0 = anchors[0]
        m1, r1 = anchors[1]
        t = (months - m0) / (m1 - m0) if m1 != m0 else 0.0
        return max(SALVAGE_FLOOR, r0 + t * (r1 - r0))

    # Between anchors
    for (m0, r0), (m1, r1) in zip(anchors[1:], anchors[2:]):
        if m0 <= months <= m1:
            t = (months - m0) / (m1 - m0)
            return max(SALVAGE_FLOOR, r0 + t * (r1 - r0))

    # Beyond last anchor → tail
    last_m, last_r = anchors[-1]
    extra_years = max(0.0, (months - last_m) / 12.0)
    r = last_r - TAIL_DECAY_PP_PER_YEAR * extra_years
    return max(SALVAGE_FLOOR, r)

def vehicle_key(type_of_vehicle: str | None) -> str:
    t = (type_of_vehicle or "").upper()
    if "BEV" in t or t == "EV" or "ELECTRIC" in t:
        return "BEV"
    if "PHEV" in t or "PLUG" in t:
        return "PHEV"
    if "HEV" in t or "HYBRID" in t:
        return "HEV"
    if "DIESEL" in t:
        return "DIESEL"
    return "PETROL"

def months_since_year(year: int, today: date | None = None) -> int:
    if not year:
        return 0
    today = today or date.today()
    # assume July registration
    start = date(year, 7, 1)
    months = (today.year - start.year) * 12 + (today.month - start.month)
    return max(0, months)

@dataclass
class DepreciationParams:
    retention: dict[str, dict[int, float]] = None
    std_km_per_year: int = STD_KM_PER_YEAR
    salvage_floor: float = SALVAGE_FLOOR
    mileage_slope_per_10k: float = MILEAGE_SLOPE_PER_10K
    bev_warranty_kink_pp: float = BEV_WARRANTY_KINK_PP
    tail_decay_pp_per_year: float = TAIL_DECAY_PP_PER_YEAR

    def __post_init__(self):
        if self.retention is None:
            self.retention = RETENTION

def predict_future_value_from_today_price(
    *, today_price: float, car_year: int, years_ahead: int,
    type_of_vehicle: str | None, yearly_km_future: int,
    params: "DepreciationParams | None" = None, today: date | None = None
) -> float:
    params = params or DepreciationParams()   # <-- instantiate here
    key = vehicle_key(type_of_vehicle)
    grid = params.retention.get(key, RETENTION["PETROL"])
    now_m = months_since_year(int(to_num(car_year, 0)), today=today)
    fut_m = now_m + years_ahead * 12
    r_now = _retention_at(grid, now_m)
    r_fut = _retention_at(grid, fut_m)
    if key in ("BEV", "PHEV") and now_m < WARRANTY_MONTHS <= fut_m:
        r_fut = max(params.salvage_floor, r_fut - params.bev_warranty_kink_pp)
    ratio = (r_fut / r_now) if r_now > 0 else 0.0
    expected = today_price * ratio
    extra_km_per_year = max(0, yearly_km_future - params.std_km_per_year)
    delta10k = (extra_km_per_year * years_ahead) / 10_000.0
    if delta10k > 0:
        expected *= max(0.0, 1.0 - params.mileage_slope_per_10k * delta10k)
    return expected

