# scripts/truncate_demo_db.py
from __future__ import annotations

import os
import sys
from pathlib import Path
from sqlalchemy import text

# --- Path bootstrap: make repo root importable ---
THIS_FILE = Path(__file__).resolve()
REPO_ROOT = THIS_FILE.parent.parent  # .../FinanceTool
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# (optional) load .env, .env.local, and .env.<APP_ENV>
try:
    from dotenv import load_dotenv  # type: ignore
    for env in (
        REPO_ROOT / ".env",
        REPO_ROOT / ".env.local",
        REPO_ROOT / f".env.{os.getenv('APP_ENV') or ''}",
    ):
        if isinstance(env, Path) and env.exists():
            load_dotenv(env, override=True)
except Exception:
    pass

from backend.app import create_app
from backend.models.models import db

SQL = """
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP
    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
  END LOOP;
END $$;
"""

app = create_app()
with app.app_context():
    print(f"DB: {db.engine.url}")
    db.session.execute(text(SQL))
    db.session.commit()
    print("Truncated all public tables (reset identity).")
