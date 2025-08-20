from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import create_app
from models.models import db, PriceSettings

def run():
    app = create_app()
    with app.app_context():
        row = PriceSettings.query.get(1)
        if not row:
            row = PriceSettings(id=1)
            db.session.add(row)
        row.el_price_ore_kwh = row.el_price_ore_kwh or 250
        row.diesel_price_sek_litre = row.diesel_price_sek_litre or 15
        row.bensin_price_sek_litre = row.bensin_price_sek_litre or 14
        row.yearly_km = row.yearly_km or 18000
        row.daily_commute_km = row.daily_commute_km or 30
        db.session.commit()
        print("Seeded PriceSettings.")

if __name__ == "__main__":
    run()
