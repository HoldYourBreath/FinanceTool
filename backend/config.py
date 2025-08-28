# backend/config.py
import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = (BASE_DIR / ".." / "instance").resolve()


def _normalize_db_url(url: str | None) -> str | None:
    """
    Accept common variants:
      - postgres://...           -> postgresql+psycopg2://...
      - postgresql://...         -> postgresql+psycopg2://...
    Leave others as-is.
    """
    if not url:
        return None
    url = url.strip()

    if url.startswith("postgres://"):
        return "postgresql+psycopg2://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
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
            return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
    except Exception:
        pass
    return url


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "default-secret-key")
    # Accept comma-separated CORS origins; default to Vite dev
    CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")

    # Database URI (normalize & fallback)
    _env_url = _normalize_db_url(os.getenv("DATABASE_URL"))

    if _env_url:
        SQLALCHEMY_DATABASE_URI = _env_url
    else:
        # Fallback only if DATABASE_URL is not set
        INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(INSTANCE_DIR / 'dev.db').as_posix()}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Helpful for startup logs (password redacted)
    EFFECTIVE_DB_URL_SAFE = _safe_url(SQLALCHEMY_DATABASE_URI)

    # Engine tweaks (mainly useful for Postgres)
    # backend/config.py  (inside Config)
    if SQLALCHEMY_DATABASE_URI.startswith("postgresql"):
        SQLALCHEMY_ENGINE_OPTIONS = {
            "pool_pre_ping": True,
            "pool_recycle": 1800,
            "connect_args": {
                "options": "-csearch_path=public"  # << force the schema with your data
            },
        }
    else:
        SQLALCHEMY_ENGINE_OPTIONS = {}

    # Optional echo (SQL logs) controlled via env
    SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "0") in ("1", "true", "True")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


def get_config() -> str:
    """Return the dotted path to the config class based on APP_ENV/FLASK_ENV."""
    env = (os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development").lower()
    if env.startswith("prod"):
        return "backend.config.ProductionConfig"
    return "backend.config.DevelopmentConfig"
