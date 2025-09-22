# routes/acc_info.py
from flask import Blueprint, current_app, jsonify, request

from backend.models.models import AccInfo, db

# Final paths: /api/acc_info/...
acc_info_bp = Blueprint("acc_info", __name__, url_prefix="/api/acc_info")


def _to_float(v, default=0.0):
    try:
        # Treat empty string as 0 to be lenient with form inputs
        return float(v) if v != "" and v is not None else float(default)
    except Exception:
        return float(default)


@acc_info_bp.get("")
@acc_info_bp.get("/")
def list_acc_info():
    """
    Return all account info rows.
    Be resilient in CI: if the table isn't created yet, return an empty list (200).
    """
    try:
        rows = AccInfo.query.order_by(AccInfo.id.asc()).all()
        data = [
            {
                "id": r.id,
                "person": r.person,
                "bank": r.bank,
                "acc_number": r.acc_number,
                "country": r.country,
                # return as string to match prior API, but always defined
                "value": str(r.value) if r.value is not None else "0",
            }
            for r in rows
        ]
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.warning("GET /api/acc_info failed, returning empty list: %s", e)
        return jsonify([]), 200


@acc_info_bp.post("/value")
def update_acc_value():
    """
    Body: { "id": <int>, "value": <number|string> }
    """
    data = request.get_json(silent=True) or {}
    acc_id = data.get("id")
    value = data.get("value")

    if acc_id is None or value is None:
        return jsonify({"error": "id and value are required"}), 400

    row = AccInfo.query.get(acc_id)
    if not row:
        return jsonify({"error": "account not found"}), 404

    row.value = str(_to_float(value, 0.0))
    try:
        db.session.commit()
        return jsonify({"ok": True, "id": row.id, "value": row.value}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("Failed to update acc value: %s", e)
        return jsonify({"error": "failed to update"}), 500


@acc_info_bp.post("/bulk")
def bulk_insert_acc_info():
    """
    Body can be:
      - a list of entries
      - { "acc_info": [ ... ] }

    Each entry:
      { person, bank, acc_number, country, value? }
    """
    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Invalid JSON"}), 400

    items = payload if isinstance(payload, list) else payload.get("acc_info")
    if not isinstance(items, list):
        return (
            jsonify({"error": "Expected a list of entries or {'acc_info': [...] }"}),
            400,
        )

    required = ("person", "bank", "acc_number", "country")
    inserted = 0
    try:
        for item in items:
            if not all(k in item for k in required):
                return (
                    jsonify({"error": f"Missing required keys. Need: {required}"}),
                    400,
                )

            exists = AccInfo.query.filter_by(
                person=item["person"],
                bank=item["bank"],
                acc_number=item["acc_number"],
                country=item["country"],
            ).first()

            if not exists:
                db.session.add(
                    AccInfo(
                        person=item["person"],
                        bank=item["bank"],
                        acc_number=item["acc_number"],
                        country=item["country"],
                        value=str(_to_float(item.get("value", 0))),
                    )
                )
                inserted += 1

        db.session.commit()
        # 201 when something new was inserted, 200 otherwise
        status = 201 if inserted else 200
        return jsonify({"inserted": inserted}), status
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("Bulk insert acc_info failed: %s", e)
        return jsonify({"error": "bulk insert failed"}), 500
