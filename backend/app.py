#app.py

import os
from flask import Flask, render_template
from models.models import db
from routes import register_routes
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()  # Load .env before accessing variables

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": os.getenv('CORS_ORIGIN')}})

    # ✅ Load DB config from env
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    register_routes(app)

    @app.route('/')
    def index():
        return render_template('index.html')

    print("🔍 Registered Routes:")
    for rule in app.url_map.iter_rules():
        print(rule)

    return app


# Flask entry point
if __name__ == '__main__':
    app = create_app()

    # Ensure tables exist
    with app.app_context():
        db.create_all()

    app.run(debug=True)
