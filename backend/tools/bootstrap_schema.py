from sqlalchemy import inspect, text

from backend.app import create_app
from backend.models.models import db


def main():
    app = create_app()
    with app.app_context():
        print("[INFO] Using DB:", app.config.get("SQLALCHEMY_DATABASE_URI"))
        insp = inspect(db.engine)

        def has_col(table, col):
            return col in {c["name"] for c in insp.get_columns(table)}

        # ---- cars.tire_replacement_interval_years ----
        if not has_col("cars", "tire_replacement_interval_years"):
            print("[MIGRATE] Add cars.tire_replacement_interval_years NUMERIC(4,2)")
            db.session.execute(text(
                "ALTER TABLE cars ADD COLUMN tire_replacement_interval_years NUMERIC(4,2)"
            ))
            db.session.commit()

        # Default to 3 years where NULL
        db.session.execute(text(
            "UPDATE cars SET tire_replacement_interval_years = 3 "
            "WHERE tire_replacement_interval_years IS NULL"
        ))
        db.session.commit()

        # ---- app_settings.tire_change_price_year ----
        if not has_col("app_settings", "tire_change_price_year"):
            print("[MIGRATE] Add app_settings.tire_change_price_year NUMERIC(10,2) DEFAULT 2000")
            db.session.execute(text(
                "ALTER TABLE app_settings ADD COLUMN tire_change_price_year NUMERIC(10,2) DEFAULT 2000"
            ))
            db.session.commit()

        # Ensure singleton row exists
        db.session.execute(text("""
            INSERT INTO app_settings (id, electricity_price_ore_kwh, bensin_price_sek_litre, diesel_price_sek_litre,
                                      yearly_driving_km, daily_commute_km, tire_change_price_year)
            SELECT 1, 250, 14, 15, 18000, 30,
                   COALESCE((SELECT tire_change_price_year FROM app_settings LIMIT 1), 2000)
            WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1)
        """))
        db.session.commit()

        # Quick verify printouts
        cols = [c["name"] for c in insp.get_columns("cars")]
        print("[OK] cars columns include:", "tire_replacement_interval_years" if "tire_replacement_interval_years" in cols else cols)
        print("[DONE] Schema OK.")

if __name__ == "__main__":
    main()
