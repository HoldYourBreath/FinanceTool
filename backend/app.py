# app.py
import os

from dotenv import load_dotenv
from flask import Flask, render_template
from flask_cors import CORS
from backend.routes import register_routes
from backend.config import get_config, Config

from backend.models.models import db

load_dotenv()


def _resolve_db_url() -> str:
    # Prefer SQLALCHEMY_DATABASE_URI; fall back to DATABASE_URL; then to sqlite
    uri = os.getenv('SQLALCHEMY_DATABASE_URI') or os.getenv('DATABASE_URL') or 'sqlite:///dev.db'
    if uri.startswith('postgres://'):
        uri = uri.replace('postgres://', 'postgresql://', 1)
    return uri


def create_app():
    app = Flask(__name__)
    app.config.from_object(get_config())

    db.init_app(app)
    register_routes(app)

    with app.app_context():
        print("[DB]", Config.EFFECTIVE_DB_URL_SAFE)

    return app


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        db.create_all()
    app.run(debug=True)
