# routes/acc_info.py
from flask import Blueprint, request, jsonify
from models.models import AccInfo, db

# final paths will be /api/acc_info/...
acc_info_bp = Blueprint("acc_info", __name__, url_prefix="/api/acc_info")

@acc_info_bp.post("/value")
def update_acc_value():
    data = request.get_json() or {}
    acc_id = data.get("id")
    value = data.get("value")
    if acc_id is None or value is None:
        return jsonify({"error": "id and value are required"}), 400

    row = AccInfo.query.get(acc_id)
    if not row:
        return jsonify({"error": "account not found"}), 404

    row.value = str(float(value) if value != "" else 0)
    db.session.commit()
    return jsonify({"ok": True, "id": row.id, "value": row.value})

@acc_info_bp.get("/")
def get_acc_info():
    acc_info_items = AccInfo.query.order_by(AccInfo.id).all()
    return jsonify([
        {
            "id": m.id,
            "person": m.person,
            "bank": m.bank,
            "acc_number": m.acc_number,
            "country": m.country,
            "value": str(m.value),
        }
        for m in acc_info_items
    ])

@acc_info_bp.post("/bulk")
def bulk_insert_acc_info():
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({"error": "Expected a list of entries"}), 400

    inserted = 0
    for item in data:
        exists = AccInfo.query.filter_by(
            person=item["person"],
            bank=item["bank"],
            acc_number=item["acc_number"],
            country=item["country"],
        ).first()
        if not exists:
            db.session.add(AccInfo(
                person=item["person"],
                bank=item["bank"],
                acc_number=item["acc_number"],
                country=item["country"],
                value=item.get("value", 0),
            ))
            inserted += 1

    db.session.commit()
    return jsonify({"inserted": inserted}), 201
