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

# Optional but handy during local/dev
try:
    from sqlalchemy.engine import make_url
except Exception:  # pragma: no cover
    make_url = None  # type: ignore

load_dotenv()


# ------------------------------- helpers ------------------------------------- #
def _as_bool(val: str | None, default: bool = False) -> bool:
    if val is None:
        return default
    return str(val).strip().lower() in {"1", "true", "yes", "on"}


def _print_routes(app: Flask) -> None:
    """Print registered routes (behind PRINT_ROUTES=1)."""
    if not _as_bool(os.getenv("PRINT_ROUTES")):
        return

    print("Registered Routes:")
    rules = sorted(
        (r for r in app.url_map.iter_rules() if r.endpoint != "static"),
        key=lambda r: (str(r.rule), ",".join(sorted(r.methods))),
    )
    for r in rules:
        methods = ",".join(
            m for m in ("GET", "POST", "PUT", "PATCH", "DELETE") if m in r.methods
        )
        print(f"{r.rule}  [{methods}]  -> {r.endpoint}")


# ------------------------------ app factory ---------------------------------- #
def create_app() -> Flask:
    app = Flask(__name__)

    # Avoid auto “/” redirects that can confuse proxies
    app.url_map.strict_slashes = False

    # Load env-specific config
    app.config.from_object(get_config())

    # Keep the key present but unset (don’t force a host:port)
    app.config["SERVER_NAME"] = None

    # Honor X-Forwarded-* when running behind Vite/proxies
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)  # type: ignore[assignment]

    # CORS for API only; allow multiple comma-separated origins via Config
    CORS(
        app,
        resources={r"/api/*": {"origins": getattr(Config, "CORS_ORIGINS_LIST", ["*"])}},
        supports_credentials=True,
    )

    # DB + routes
    db.init_app(app)
    register_routes(app)  # blueprints define endpoints; mounted under "/api" inside

    # Startup info + optional route print
    with app.app_context():
        print("[DB]", getattr(Config, "EFFECTIVE_DB_URL_SAFE", "<unknown>"))

        # ✅ Ensure tables exist for ephemeral SQLite test envs,
        # or when explicitly requested via AUTO_CREATE_DB=1
        should_create = _as_bool(os.getenv("AUTO_CREATE_DB"))
        try:
            if make_url is not None:
                url = make_url(app.config.get("SQLALCHEMY_DATABASE_URI", ""))
                if url.get_backend_name().startswith("sqlite"):
                    should_create = True  # always create for SQLite e2e/test DBs
        except Exception:
            # If parsing fails, fall back to env flag only
            pass

        if should_create:
            db.create_all()

        _print_routes(app)

    # Best-effort debug headers on every response
    @app.after_request
    def _add_debug_headers(resp):
        try:
            eng = getattr(db, "engine", None)
            if eng is not None:
                resp.headers["X-DB-DIALECT"] = getattr(eng.dialect, "name", "")
            resp.headers["X-DB-URL"] = getattr(Config, "EFFECTIVE_DB_URL_SAFE", "")
            resp.headers["X-BACKEND"] = request.host
        except Exception:
            pass
        return resp

    return app


# ------------------------------ script entry --------------------------------- #
if __name__ == "__main__":
    app = create_app()

    # For non-SQLite prod/dev you can still force table creation:
    #   AUTO_CREATE_DB=1 python backend/app.py
    # (SQLite is handled automatically inside create_app.)
    app.run(
        host=os.getenv("FLASK_RUN_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_RUN_PORT", "5000")),  # demo script may use 5001
        debug=_as_bool(os.getenv("FLASK_DEBUG")),
    )
