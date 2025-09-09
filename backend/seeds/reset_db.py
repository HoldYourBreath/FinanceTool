# backend/seeds/reset_db.py
from __future__ import annotations

import sys
from pathlib import Path

# Add repo root to sys.path so "import backend.*" works when running as a script
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app import create_app
from backend.models.models import db

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        print("🔄 Resetting database...")
        db.drop_all()
        db.create_all()
        print("✅ DB reset")

