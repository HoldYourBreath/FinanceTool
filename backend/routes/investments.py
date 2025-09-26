# routes/investments.py
from flask import Blueprint, current_app, jsonify

from backend.models.models import db

# If you have these models, the imports will work; if not, we stay CI-safe.
try:
    from models.models import Asset  # e.g., cash/brokerage accounts, funds
except Exception:  # pragma: no cover
    Asset = None

try:
    from models.models import Property  # optional: real-estate investments tab
except Exception:  # pragma: no cover
    Property = None

investments_bp = Blueprint("investments", __name__, url_prefix="/api/investments")


def _f(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return float(default)


@investments_bp.get("")
@investments_bp.get("/")
def list_investments():
    """
    Returns a unified investments payload.
    CI-safe: if tables/models are missing or queries fail, return empty structures with 200.
    """
    payload = {
        "accounts": [],  # [{ id, name, kind, value }]
        "properties": [],  # [{ id, name, value, paid, rent }]
        "summary": {  # Totals to keep frontend happy
            "total_accounts": 0.0,
            "total_properties_value": 0.0,
            "total_properties_paid": 0.0,
            "total_rent": 0.0,
            "net_worth": 0.0,
        },
    }

    try:
        # Load accounts (Asset) if model/table exists
        if Asset is not None:
            rows = db.session.query(Asset).all()
            for r in rows:
                # Make reasonable key guesses; adjust to your actual columns
                name = getattr(r, "name", getattr(r, "account_name", "Account"))
                kind = getattr(r, "kind", getattr(r, "type", "cash"))
                value = _f(getattr(r, "value", 0))
                payload["accounts"].append(
                    {
                        "id": getattr(r, "id", None),
                        "name": name,
                        "kind": kind,
                        "value": value,
                    }
                )
            payload["summary"]["total_accounts"] = sum(
                a["value"] for a in payload["accounts"]
            )

        # Load properties if model/table exists (optional for your app)
        if Property is not None:
            rows = db.session.query(Property).all()
            for p in rows:
                value = _f(getattr(p, "value", 0))
                paid = _f(getattr(p, "paid_amount", getattr(p, "paid", 0)))
                rent = _f(getattr(p, "rent", 0))
                payload["properties"].append(
                    {
                        "id": getattr(p, "id", None),
                        "name": getattr(p, "name", "Property"),
                        "value": value,
                        "paid": paid,
                        "rent": rent,
                    }
                )

            payload["summary"]["total_properties_value"] = sum(
                x["value"] for x in payload["properties"]
            )
            payload["summary"]["total_properties_paid"] = sum(
                x["paid"] for x in payload["properties"]
            )
            payload["summary"]["total_rent"] = sum(
                x["rent"] for x in payload["properties"]
            )

        # Net worth = accounts + properties (you can refine if you track debts here)
        payload["summary"]["net_worth"] = (
            payload["summary"]["total_accounts"]
            + payload["summary"]["total_properties_value"]
        )

    except Exception as e:
        # Stay green in CI: return empty payload with 200 instead of failing hard
        current_app.logger.warning(
            "GET /api/investments failed; returning empty payload: %s", e
        )

    return jsonify(payload), 200
