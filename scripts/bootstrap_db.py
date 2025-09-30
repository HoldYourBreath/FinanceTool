# scripts/bootstrap_db.py
from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url, URL

# --- Path bootstrap so we can import backend.* no matter where we run this ---
THIS_FILE = Path(__file__).resolve()
REPO_ROOT = THIS_FILE.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from flask import Flask
from backend.models.models import db  # noqa: E402

# --- Optional .env loading (repo and backend dirs; env-specific respected) ---
try:
    from dotenv import load_dotenv  # type: ignore

    def _load(p: Path) -> None:
        if p.exists():
            load_dotenv(p, override=True)

    _load(REPO_ROOT / ".env")
    _load(REPO_ROOT / ".env.local")
    env = os.getenv("APP_ENV")
    if env:
        _load(REPOOT := REPO_ROOT / f".env.{env}")  # type: ignore[name-defined]
        _load(REPO_ROOT / "backend" / f".env.{env}")
    _load(REPO_ROOT / "backend" / ".env")
    _load(REPO_ROOT / "backend" / ".env.local")
except Exception:
    pass


def _ensure_db_exists(db_url: str) -> None:
    """
    Connect to the server (database='postgres') and create the target database if missing.
    Requires a role with CREATEDB.
    """
    url: URL = make_url(db_url)
    db_name = url.database
    if not db_name:
        raise RuntimeError("No database name in SQLALCHEMY_DATABASE_URI / DATABASE_URL.")

    server_url = url.set(database="postgres")
    engine = create_engine(server_url, isolation_level="AUTOCOMMIT")

    with engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"),
            {"n": db_name},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))
            print(f'🆕 Created database "{db_name}".')
        else:
            print(f'✅ Database "{db_name}" already exists.')


def _recreate_db(db_url: str) -> None:
    """
    Drop + recreate the database (terminates active connections).
    Use for a truly clean install test.
    """
    url: URL = make_url(db_url)
    db_name = url.database
    if not db_name:
        raise RuntimeError("No database name in SQLALCHEMY_DATABASE_URI / DATABASE_URL.")

    server_url = url.set(database="postgres")
    engine = create_engine(server_url, isolation_level="AUTOCOMMIT")

    with engine.connect() as conn:
        conn.execute(
            text(
                """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = :n AND pid <> pg_backend_pid()
                """
            ),
            {"n": db_name},
        )
        conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}"'))
        conn.execute(text(f'CREATE DATABASE "{db_name}"'))
        print(f'🔄 Recreated database "{db_name}".')


def bootstrap(create_schema: bool = True, recreate: bool = False) -> None:
    db_uri = os.getenv("SQLALCHEMY_DATABASE_URI") or os.getenv("DATABASE_URL")
    if not db_uri:
        raise RuntimeError("Set SQLALCHEMY_DATABASE_URI or DATABASE_URL to a PostgreSQL URI.")

    if recreate:
        _recreate_db(db_uri)
    else:
        _ensure_db_exists(db_uri)

    if create_schema:
        # Bind directly to the target DB URI; don't let app factory / .env override it.
        app = Flask("bootstrap")
        app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
        app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
        db.init_app(app)

        with app.app_context():
            db.create_all()
            print("📦 Schema created (db.create_all).")
            res = db.session.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")
            )
            print("🗂️  Public tables:")
            for (t,) in res.fetchall():
                print(f"   - {t}")


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Bootstrap database (create/recreate + schema).")
    ap.add_argument("--recreate", action="store_true", help="Drop and re-create the database")
    ap.add_argument("--no-schema", action="store_true", help="Do not run db.create_all()")
    args = ap.parse_args()

    bootstrap(create_schema=not args.no_schema, recreate=args.recreate)
