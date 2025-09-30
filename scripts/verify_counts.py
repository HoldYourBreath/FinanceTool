from __future__ import annotations
import os, sys
from pathlib import Path
from sqlalchemy import text
from flask import Flask

# repo bootstrap
THIS = Path(__file__).resolve()
REPO_ROOT = THIS.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.models.models import db  # noqa: E402

TABLES = ["acc_info","investments","months","incomes","expenses","financing","planned_purchases","cars"]

def _get_db_uri() -> str:
    uri = os.getenv("SQLALCHEMY_DATABASE_URI") or os.getenv("DATABASE_URL")
    if not uri:
        # only load .env if missing; do NOT override environment
        try:
            from dotenv import load_dotenv  # type: ignore
            for p in (REPO_ROOT/".env", REPO_ROOT/".env.local",
                      REPO_ROOT/"backend"/".env", REPO_ROOT/"backend"/".env.local"):
                if p.exists():
                    load_dotenv(p, override=False)
            uri = os.getenv("SQLALCHEMY_DATABASE_URI") or os.getenv("DATABASE_URL")
        except Exception:
            pass
    if not uri:
        raise RuntimeError("No SQLALCHEMY_DATABASE_URI/DATABASE_URL set.")
    return uri

DB_URI = _get_db_uri()

app = Flask("verify_counts")
app.config["SQLALCHEMY_DATABASE_URI"] = DB_URI
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

with app.app_context():
    print("DB:", db.engine.url)
    for t in TABLES:
        try:
            n = db.session.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
            print(f"{t}: {n}")
        except Exception as e:
            print(f"{t}: (error) {e}")
