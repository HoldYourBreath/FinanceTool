# backend/app.py
import os

from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS

from backend.config import Config, get_config
from backend.models.models import db
from backend.routes import register_routes  # must register blueprints with url_prefix="/api"

load_dotenv()


def _print_routes(app: Flask) -> None:
    """Optionally print registered routes at startup for quick verification."""
    if os.getenv("PRINT_ROUTES", "0").lower() not in {"1", "true", "yes", "on"}:
        return
    print("Registered Routes:")
    rules = sorted(app.url_map.iter_rules(), key=lambda r: (str(r.rule), ",".join(sorted(r.methods))))
    for r in rules:
        if r.endpoint == "static":
            continue
        methods = ",".join(sorted(m for m in r.methods if m in {"GET", "POST", "PUT", "PATCH", "DELETE"}))
        print(f"{r.rule}  [{methods}]  -> {r.endpoint}")


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(get_config())

    # CORS (accept comma-separated origins via Config)
    CORS(
        app,
        resources={r"/api/*": {"origins": Config.CORS_ORIGINS_LIST}},
        supports_credentials=True,
    )

    # DB + routes
    db.init_app(app)

    # NOTE: Each blueprint (incl. car_evaluation.cars_bp) should be defined WITHOUT url_prefix.
    # register_routes(app) must attach them with url_prefix="/api".
    register_routes(app)

    # Helpful startup log (password redacted)
    with app.app_context():
        print("[DB]", Config.EFFECTIVE_DB_URL_SAFE)
        _print_routes(app)

    # Per-response debug headers so you can see which backend/DB served it
    @app.after_request
    def add_debug_headers(resp):
        try:
            resp.headers["X-DB-DIALECT"] = db.engine.dialect.name
            resp.headers["X-DB-URL"] = Config.EFFECTIVE_DB_URL_SAFE
            resp.headers["X-BACKEND"] = request.host
        except Exception:
            pass
        return resp

    return app


if __name__ == "__main__":
    app = create_app()

    # Optional: create tables automatically (useful on fresh demo DB).
    # Toggle with AUTO_CREATE_DB=1 to avoid surprising prod/dev behavior.
    if os.getenv("AUTO_CREATE_DB", "0").lower() in {"1", "true", "yes", "on"}:
        with app.app_context():
            db.create_all()

    app.run(
        host=os.getenv("FLASK_RUN_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_RUN_PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0").lower() in {"1", "true", "yes", "on"},
    )
