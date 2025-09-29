# backend/routes/my_new_tab.py
from flask import Blueprint, jsonify

my_new_tab_bp = Blueprint("my_new_tab", __name__, url_prefix="/api/my_new_tab")


@my_new_tab_bp.get("")
def list_items():
    return jsonify({"items": []})
