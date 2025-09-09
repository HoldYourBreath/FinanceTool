# backend/tools/bootstrap_schema.py
from __future__ import annotations

from typing import Iterable
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from backend.app import create_app
from backend.models.models import db


def _has_table(engine: Engine, table: str) -> bool:
    insp = inspect(engine)
    return table in insp.get_table_names()

def _has_col(engine: Engine, table: str, col: str) -> bool:
    insp = inspect(engine)
    if not _has_table(engine, table):
        return False
    return any(c["name"] == col for c in insp.get_columns(table))

def _exec(sql: str) -> None:
    db.session.execute(text(sql))

def _add_col_if_missing(engine: Engine, table: str, col: str, ddl: str) -> bool:
    if not _has_table(engine, table):
        print(f"[SKIP] Table '{table}' not found; skipping add column '{col}'.")
        return False
    if _has_col(engine, table, col):
        print(f"[OK]    {table}.{col} already exists.")
        return False
    print(f"[MIGRATE] Add {table}.{col} {ddl}")
    _exec(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")
    db.session.commit()
    return True

def _drop_cols_if_exist(engine: Engine, table: str, cols: Iterable[str]) -> None:
    if not _has_table(engine, table):
        return
    for col in cols:
        if _has_col(engine, table, col):
            print(f"[MIGRATE] Drop {table}.{col}")
            _exec(f"ALTER TABLE {table} DROP COLUMN IF EXISTS {col}")
            db.session.commit()

def main() -> None:
    app = create_app()
    with app.app_context():
        uri = app.config.get("SQLALCHEMY_DATABASE_URI")
        print("[INFO] Using DB:", uri)
        engine = db.engine

        # ---- cars.tire_replacement_interval_years ----
        _add_col_if_missing(
            engine,
            "cars",
            "tire_replacement_interval_years",
            "NUMERIC(4,2)"
        )

        # Default to 3 years where NULL (safe to run repeatedly)
        if _has_table(engine, "cars"):
            _exec(
                """
                UPDATE cars
                   SET tire_replacement_interval_years = 3
                 WHERE tire_replacement_interval_years IS NULL
                """
            )
            db.session.commit()

        # ---- app_settings.tire_change_price_year ----
        _add_col_if_missing(
            engine,
            "app_settings",
            "tire_change_price_year",
            "NUMERIC(10,2) DEFAULT 2000"
        )

        # Ensure singleton row exists (id=1); do not overwrite existing
        if _has_table(engine, "app_settings"):
            _exec(
                """
                INSERT INTO app_settings
                    (id, electricity_price_ore_kwh, bensin_price_sek_litre, diesel_price_sek_litre,
                     yearly_driving_km, daily_commute_km, tire_change_price_year)
                SELECT 1, 250, 14, 15, 18000, 30,
                       COALESCE(
                         (SELECT tire_change_price_year FROM app_settings LIMIT 1),
                         2000
                       )
                 WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1)
                """
            )
            db.session.commit()

        # ---- cleanup: drop deprecated *_est columns on cars ----
        _drop_cols_if_exist(
            engine,
            "cars",
            cols=("dc_time_min_10_80_est", "ac_time_h_0_100_est"),
        )

        # ---- quick verify printouts ----
        if _has_table(engine, "cars"):
            cols = [c["name"] for c in inspect(engine).get_columns("cars")]
            print("[OK] cars columns:", ", ".join(sorted(cols)))
        print("[DONE] Schema OK.")


if __name__ == "__main__":
    main()
