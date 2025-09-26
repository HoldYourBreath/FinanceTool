# backend/config.py
import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv

# Load environment variables from .env (dev/demo files or process env)
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = (BASE_DIR / ".." / "instance").resolve()


def _normalize_db_url(url: str | None) -> str | None:
    """
    Normalize common Postgres URL variants to 'postgresql+psycopg2://...'.
    """
    if not url:
        return None
    url = url.strip()
    if url.startswith("postgres://"):
        return "postgresql+psycopg2://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and "+psycopg2" not in url:
        return "postgresql+psycopg2://" + url[len("postgresql://") :]
    return url


def _safe_url(url: str) -> str:
    """Redact password for logging."""
    try:
        parts = urlsplit(url)
        if parts.password:
            netloc = parts.hostname or ""
            if parts.username:
                netloc = f"{parts.username}:***@{netloc}"
            if parts.port:
                netloc = f"{netloc}:{parts.port}"
            return urlunsplit(
                (parts.scheme, netloc, parts.path, parts.query, parts.fragment)
            )
    except Exception:
        pass
    return url


class Config:
    # --- General ---
    SECRET_KEY = os.getenv("SECRET_KEY", "default-secret-key")

    # Accept either CORS_ORIGIN or CORS_ORIGINS (comma-separated)
    _cors = (
        os.getenv("CORS_ORIGIN") or os.getenv("CORS_ORIGINS") or "http://localhost:5173"
    )
    CORS_ORIGIN = _cors  # keep string for simple setups
    CORS_ORIGINS_LIST = (
        [x.strip() for x in _cors.split(",")] if _cors else ["http://localhost:5173"]
    )

    # --- Environment selection (dev/demo/prod) ---
    APP_ENV = (os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "dev").lower()

    # Primary URLs
    DEMO_DATABASE_URL = _normalize_db_url(os.getenv("DEMO_DATABASE_URL"))
    DATABASE_URL = _normalize_db_url(os.getenv("DATABASE_URL"))

    # Choose DB per env:
    # - demo  -> DEMO_DATABASE_URL (required for demo), fallback to DATABASE_URL
    # - other -> DATABASE_URL
    _chosen = None
    if APP_ENV == "demo" and DEMO_DATABASE_URL:
        _chosen = DEMO_DATABASE_URL
    elif DATABASE_URL:
        _chosen = DATABASE_URL

    # Final fallback (avoid SQLite to keep parity with prod)
    if not _chosen:
        # Adjust the host/creds if needed for your local PG
        _chosen = (
            "postgresql+psycopg2://postgres:admin@localhost:5432/financial_tracker"
        )

    SQLALCHEMY_DATABASE_URI = _chosen
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "0").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    # Helpful for startup logs (password redacted)
    EFFECTIVE_DB_URL_SAFE = _safe_url(SQLALCHEMY_DATABASE_URI)

    # Engine options (Postgres)
    if SQLALCHEMY_DATABASE_URI.startswith("postgresql"):
        SQLALCHEMY_ENGINE_OPTIONS = {
            "pool_pre_ping": True,
            "pool_recycle": 1800,
            # Force default schema to 'public' (adjust if you use another schema)
            "connect_args": {"options": "-csearch_path=public"},
        }
    else:
        # If you truly need SQLite in some niche case, add options here.
        SQLALCHEMY_ENGINE_OPTIONS = {}


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


def get_config() -> str:
    """Return the dotted path to the config class based on APP_ENV/FLASK_ENV."""
    env = Config.APP_ENV
    if env.startswith("prod"):
        return "backend.config.ProductionConfig"
    return "backend.config.DevelopmentConfig"
