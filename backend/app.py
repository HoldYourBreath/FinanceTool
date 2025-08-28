# app.py
import os

from dotenv import load_dotenv
from flask import Flask, render_template
from flask_cors import CORS
from backend.routes import register_routes

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
    cors_origin = os.getenv('CORS_ORIGIN', 'http://localhost:5173')
    CORS(app, resources={r'/api/*': {'origins': cors_origin}})

    app.config['SQLALCHEMY_DATABASE_URI'] = _resolve_db_url()
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    register_routes(app)

    @app.route('/')
    def index():
        return render_template('index.html')

    return app


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        db.create_all()
    app.run(debug=True)
