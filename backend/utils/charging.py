from __future__ import annotations


def estimate_dc_10_80_minutes(batt_kwh, dc_peak_kw) -> float:
    """Estimate 10→80% DC charge time (minutes) if data is missing."""
    if batt_kwh and dc_peak_kw:
        # 70% of battery, assume avg power ≈ 60% of peak
        return round(((0.70 * float(batt_kwh)) / (0.60 * float(dc_peak_kw))) * 60.0, 2)
    return 0.0


def estimate_ac_0_100_hours(batt_kwh, ac_kw) -> float:
    """Estimate 0→100% AC charge time (hours) if data is missing."""
    if batt_kwh and ac_kw:
        return round(float(batt_kwh) / float(ac_kw), 2)
    if batt_kwh:
        return round(float(batt_kwh) / 11.0, 2)
    return 0.0
