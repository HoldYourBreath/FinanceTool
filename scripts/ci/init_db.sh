#!/usr/bin/env bash
import os
from backend.app import create_app
from backend.models.models import db

os.environ.setdefault("SQLALCHEMY_DATABASE_URI", "sqlite:///ci.db")

app = create_app()
with app.app_context():
    db.create_all()
    print("✅ DB ready")
