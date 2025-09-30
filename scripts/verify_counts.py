from __future__ import annotations
import sys
from pathlib import Path
from sqlalchemy import text

# ensure repo root importable regardless of CWD
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app import create_app
from backend.models.models import db

tables = ["acc_info","investments","months","incomes","expenses","financing","planned_purchases"]

app = create_app()
with app.app_context():
    print(f"DB: {db.engine.url}")
    for t in tables:
        try:
            n = db.session.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
            print(f"{t}: {n}")
        except Exception as e:
            print(f"{t}: (missing) {e}")
