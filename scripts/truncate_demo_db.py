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

# ---- Optional dotenv loading (do not clobber process env)
try:
    from dotenv import load_dotenv  # type: ignore
    def _load(p: Path) -> None:
        if p.exists():
            # override=False keeps any vars you've already set in the shell
            load_dotenv(p, override=False)

    # Base first
    _load(REPO_ROOT / ".env")
    _load(REPO_ROOT / "backend" / ".env")
    _load(REPO_ROOT / ".env.local")
    _load(REPO_ROOT / "backend" / ".env.local")

    # Env-specific LAST (so they can override the base files, but not your shell)
    env = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
    if env:
        _load(REPO_ROOT / f".env.{env}")
        _load(REPO_ROOT / "backend" / f".env.{env}")
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
