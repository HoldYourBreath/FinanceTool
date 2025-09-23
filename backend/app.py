# backend/app.py
from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from backend.config import Config, get_config
from backend.models.models import db
from backend.routes import register_routes  # blueprints mounted under "/api"

load_dotenv()


# ---- helpers -----------------------------------------------------------------
def _as_bool(val: str | None, default: bool = False) -> bool:
    if val is None:
        return default
    return str(val).strip().lower() in {"1", "true", "yes", "on"}


def _print_routes(app: Flask) -> None:
    """Optionally print registered routes at startup for quick verification."""
    if not _as_bool(os.getenv("PRINT_ROUTES")):
        return

    print("Registered Routes:")
    rules = sorted(
        app.url_map.iter_rules(), key=lambda r: (str(r.rule), ",".join(sorted(r.methods)))
    )
    for r in rules:
        if r.endpoint == "static":
            continue
        methods = ",".join(
            sorted(m for m in r.methods if m in {"GET", "POST", "PUT", "PATCH", "DELETE"})
        )
        print(f"{r.rule}  [{methods}]  -> {r.endpoint}")


# ---- app factory --------------------------------------------------------------
def create_app() -> Flask:
    app = Flask(__name__)

    # Avoid auto “/” redirects which can confuse proxies (e.g., defaulting to :5000).
    app.url_map.strict_slashes = False

    # Load env-specific config
    app.config.from_object(get_config())

    # Keep key present but unset to avoid KeyError while not forcing a host:port.
    app.config["SERVER_NAME"] = None

    # Honor X-Forwarded-* headers from Vite/any proxy so absolute URLs use the right origin.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)  # type: ignore[assignment]

    # CORS: accept comma-separated origins via Config
    CORS(
        app,
        resources={r"/api/*": {"origins": getattr(Config, "CORS_ORIGINS_LIST", ["*"])}},
        supports_credentials=True,
    )

    # DB + routes
    db.init_app(app)
    register_routes(app)  # blueprints defined without url_prefix; mounted here under "/api"

    # Helpful startup log (password redacted)
    with app.app_context():
        print("[DB]", getattr(Config, "EFFECTIVE_DB_URL_SAFE", "<unknown>"))
        _print_routes(app)

    # Per-response debug headers (best-effort)
    @app.after_request
    def _add_debug_headers(resp):
        try:
            # db.engine may not be bound during app init errors; guard accesses
            eng = getattr(db, "engine", None)
            if eng is not None:
                resp.headers["X-DB-DIALECT"] = getattr(eng.dialect, "name", "")
            resp.headers["X-DB-URL"] = getattr(Config, "EFFECTIVE_DB_URL_SAFE", "")
            resp.headers["X-BACKEND"] = request.host
        except Exception:
            pass
        return resp

    return app


# ---- script entry -------------------------------------------------------------
if __name__ == "__main__":
    app = create_app()

    # Optional: create tables automatically on fresh demo DB.
    if _as_bool(os.getenv("AUTO_CREATE_DB")):
        with app.app_context():
            db.create_all()

    app.run(
        host=os.getenv("FLASK_RUN_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_RUN_PORT", "5000")),  # demo script may set this to 5001
        debug=_as_bool(os.getenv("FLASK_DEBUG")),
    )
