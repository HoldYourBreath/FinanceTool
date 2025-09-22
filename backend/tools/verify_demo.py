from sqlalchemy import inspect, text

from backend.app import create_app
from backend.models.models import db

app = create_app()
with app.app_context():
    print("[INFO] DB:", app.config.get("SQLALCHEMY_DATABASE_URI"))
    insp = inspect(db.engine)
    cols = [c["name"] for c in insp.get_columns("cars")]
    print(
        "[CHECK] has tire_replacement_interval_years:",
        "tire_replacement_interval_years" in cols,
    )

    # Count rows
    n = db.session.execute(text("SELECT COUNT(*) FROM cars")).scalar()
    print("[CHECK] cars rowcount:", n)
