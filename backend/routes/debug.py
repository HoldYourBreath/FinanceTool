# backend/routes/debug.py
from flask import Blueprint, jsonify
from sqlalchemy import inspect, text

from backend.models.models import Month, db

debug_bp = Blueprint("debug", __name__, url_prefix="/api/debug")


@debug_bp.get("/db")
def db_info():
    out = {"engine": str(db.engine.url), "dialect": db.engine.dialect.name}

    # Works on any DB
    try:
        out["months_count"] = db.session.query(Month).count()
    except Exception as e:
        out["months_count_error"] = str(e)

    # List tables portably
    try:
        out["tables"] = inspect(db.engine).get_table_names()
    except Exception as e:
        out["tables_error"] = str(e)

    # Extra details per dialect
    if out["dialect"].startswith("postgres"):
        try:
            row = (
                db.session.execute(
                    text(
                        """
                SELECT current_database() AS db,
                       current_user AS user,
                       current_setting('search_path') AS search_path
            """
                    )
                )
                .mappings()
                .first()
            )
            out.update(dict(row))
        except Exception as e:
            out["pg_meta_error"] = str(e)
    elif out["dialect"] == "sqlite":
        try:
            out["db_file"] = db.engine.url.database
            rows = db.session.execute(text("PRAGMA database_list")).all()
            out["sqlite_databases"] = [tuple(r) for r in rows]
        except Exception as e:
            out["sqlite_meta_error"] = str(e)

    return jsonify(out), 200
