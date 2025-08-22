
from __future__ import annotations

def to_num(v, default=0.0):
    """Coerce a value to float with tolerant parsing."""
    try:
        if v is None:
            return default
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v).replace(" ", "").replace("\u00A0", "").replace(",", ".")
        return float(s)
    except Exception:
        return default
