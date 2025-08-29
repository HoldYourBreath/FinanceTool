# backend/app.py
import os
from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS

from backend.config import get_config, Config
from backend.models.models import db
from backend.routes import register_routes

load_dotenv()


def create_app():
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
    register_routes(app)

    # Helpful startup log (password redacted)
    with app.app_context():
        print("[DB]", Config.EFFECTIVE_DB_URL_SAFE)

    # Per-response debug headers so you can see which backend/DB served it
    @app.after_request
    def add_debug_headers(resp):
        try:
            resp.headers["X-DB-DIALECT"] = db.engine.dialect.name      # sqlite / postgresql
            resp.headers["X-DB-URL"] = str(db.engine.url)              # …/financial_tracker or …_demo
            resp.headers["X-BACKEND"] = request.host                    # e.g., 127.0.0.1:5001
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
