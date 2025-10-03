from datetime import datetime
from decimal import Decimal

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Numeric, func
from sqlalchemy.orm import synonym

db = SQLAlchemy()

vehicle_type_enum = SAEnum(
    "EV", "Bensin", "Diesel", "PHEV", name="vehicle_type", native_enum=True
)


# ----------------------------- Utility -----------------------------
def _as_float(v):
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    try:
        return float(v)
    except Exception:
        return None


# =============================== Core ===============================
class Month(db.Model):
    __tablename__ = "months"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    starting_funds = db.Column(db.Numeric, default=0)
    ending_funds = db.Column(db.Numeric, default=0)
    surplus = db.Column(db.Numeric, default=0)
    loan_remaining = db.Column(db.Numeric, default=0)
    is_current = db.Column(db.Boolean, default=False)
    month_date = db.Column(db.Date, nullable=True)

    incomes = db.relationship("Income", backref="month", lazy=True)
    expenses = db.relationship("Expense", backref="month", lazy=True)
    loan_adjustments = db.relationship("LoanAdjustment", backref="month", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "startingFunds": float(self.starting_funds or 0),
            "endingFunds": float(self.ending_funds or 0),
            "surplus": float(self.surplus or 0),
            "loanRemaining": float(self.loan_remaining or 0),
            "incomes": [i.to_dict() for i in self.incomes],
            "expenses": [e.to_dict() for e in self.expenses],
            "loanAdjustments": [adj.to_dict() for adj in self.loan_adjustments],
        }


class Income(db.Model):
    __tablename__ = "incomes"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    month_id = db.Column(db.Integer, db.ForeignKey("months.id"), nullable=False)
    source = db.Column(db.Text, nullable=True)
    amount = db.Column(db.Numeric, nullable=False)
    created_at = db.Column(db.DateTime, server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "amount": float(self.amount or 0),
            "source": self.source,
        }


class Expense(db.Model):
    __tablename__ = "expenses"

    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(64), nullable=False)
    month_id = db.Column(db.Integer, db.ForeignKey("months.id"), nullable=False)
    name = db.Column(db.Text)  # real column
    description = synonym("name")  # back-compat alias (no DB column)
    amount = db.Column(db.Numeric, nullable=False)
    created_at = db.Column(db.DateTime, server_default=func.now())


class LoanAdjustment(db.Model):
    __tablename__ = "loan_adjustments"
    id = db.Column(db.Integer, primary_key=True)
    month_id = db.Column(db.Integer, db.ForeignKey("months.id"))
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(32))
    amount = db.Column(db.Numeric)
    note = db.Column(db.String(128))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "amount": float(self.amount or 0),
            "note": self.note,
        }


class HouseCost(db.Model):
    __tablename__ = "house_costs"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    amount = db.Column(db.Numeric, nullable=False)
    status = db.Column(
        SAEnum("done", "todo", name="cost_status"), nullable=False, default="todo"
    )
    created_at = db.Column(db.DateTime, server_default=func.now())


class LandCost(db.Model):
    __tablename__ = "land_costs"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, nullable=False)
    amount = db.Column(db.Numeric, nullable=False)
    status = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, server_default=func.now())


class PlannedPurchase(db.Model):
    __tablename__ = "planned_purchases"
    id = db.Column(db.Integer, primary_key=True)
    item = db.Column(db.String, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "item": self.item,
            "amount": self.amount,
            "date": self.date.isoformat() if self.date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Investment(db.Model):
    __tablename__ = "investments"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    value = db.Column(db.Integer, nullable=False)
    paid = db.Column(db.Integer, nullable=False)
    rent = db.Column(db.Integer, nullable=False)


class AccInfo(db.Model):
    __tablename__ = "acc_info"
    id = db.Column(db.Integer, primary_key=True)
    person = db.Column(db.String, nullable=False)
    bank = db.Column(db.String)
    acc_number = db.Column(db.String)
    country = db.Column(db.String)
    value = db.Column(db.Numeric)


class Financing(db.Model):
    __tablename__ = "financing"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    value = db.Column(db.Numeric, nullable=False)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "value": float(self.value or 0)}


# =============================== Cars ===============================
class Car(db.Model):
    __tablename__ = "cars"
    id = db.Column(db.Integer, primary_key=True)

    model = db.Column(db.String(255), nullable=False)
    year = db.Column(db.Integer, nullable=False)

    estimated_purchase_price = db.Column(db.Integer, default=0)

    # Tire prices (actual set prices; displayed in UI)
    summer_tires_price = db.Column(db.Integer, default=0)  # SEK/set
    winter_tires_price = db.Column(db.Integer, default=0)  # SEK/set

    # Replacement interval in years (per car)
    tire_replacement_interval_years = db.Column(Numeric(4, 2), nullable=True, default=3)

    # Energy / consumption
    consumption_kwh_per_100km = db.Column(
        Numeric(6, 2), nullable=True
    )  # prefer None over 0.00 when unknown
    consumption_l_per_100km = db.Column(db.Float, nullable=True, default=0.0)

    type_of_vehicle = db.Column(vehicle_type_enum, nullable=False, server_default="EV")
    battery_capacity_kwh = db.Column(db.Numeric(6, 2), default=0)
    acceleration_0_100 = db.Column(db.Float)
    range_km = db.Column(db.Integer, nullable=True)
    driven_km = db.Column(db.Integer, default=0)
    battery_aviloo_score = db.Column(db.Integer, default=0)
    trunk_size_litre = db.Column(db.Integer, default=0)

    full_insurance_year = db.Column(db.Integer, default=0)
    half_insurance_year = db.Column(db.Integer, default=0)
    car_tax_year = db.Column(db.Integer, default=0)
    repairs_year = db.Column(db.Integer, default=0)

    body_style = db.Column(db.String(20), index=True)  # e.g., 'SUV', 'Sedan'
    eu_segment = db.Column(db.String(2), index=True)  # e.g., 'B', 'C', 'D'
    suv_tier = db.Column(db.String(12), index=True)

    # Charging / timing
    dc_peak_kw = db.Column(db.Float)
    dc_time_min_10_80 = db.Column(db.Float)
    dc_time_source = db.Column(db.Text)
    ac_onboard_kw = db.Column(db.Float)
    ac_time_h_0_100 = db.Column(db.Float)
    ac_time_source = db.Column(db.Text)

    # Derived totals (optional; can be recomputed on the fly)
    tco_3_years = db.Column(Numeric(12, 2), default=0)
    tco_5_years = db.Column(Numeric(12, 2), default=0)
    tco_8_years = db.Column(Numeric(12, 2), default=0)

    # Legacy (kept during transition)
    insurance_cost = db.Column(Numeric(12, 2), default=0)
    tire_cost = db.Column(Numeric(12, 2), default=0)
    car_tax = db.Column(Numeric(12, 2), default=0)
    consumption_cost = db.Column(Numeric(12, 2), default=0)

    # ---- Tires math ----
    def annual_tire_cost(self, tire_change_price_year: Decimal) -> Decimal:
        """(summer + winter)/interval + yearly change fee"""
        summer = Decimal(str(self.summer_tires_price or 0))
        winter = Decimal(str(self.winter_tires_price or 0))
        interval = Decimal(str(self.tire_replacement_interval_years or 0)) or Decimal(3)
        return (summer + winter) / interval + (tire_change_price_year or Decimal(0))

    # ---- API serialization ----
    def to_dict(self, tire_change_price_year: Decimal | None = None):
        """
        If tire_change_price_year is provided (from AppSettings), include derived 'tires_year_effective'.
        Otherwise, omit it or compute with 0 as a safe fallback.
        """
        d = {
            "id": self.id,
            "model": self.model,
            "year": self.year,
            "estimated_purchase_price": self.estimated_purchase_price,
            "summer_tires_price": self.summer_tires_price,
            "winter_tires_price": self.winter_tires_price,
            "tire_replacement_interval_years": _as_float(
                self.tire_replacement_interval_years
            )
            or 3,
            # Preferred snake_case + back-compat key for frontend
            "consumption_kwh_100km": _as_float(self.consumption_kwh_per_100km),
            "consumption_kwh_per_100km": _as_float(self.consumption_kwh_per_100km),
            "consumption_l_100km": _as_float(self.consumption_l_per_100km),
            "type_of_vehicle": self.type_of_vehicle,
            "battery_capacity_kwh": _as_float(self.battery_capacity_kwh),
            "acceleration_0_100": _as_float(self.acceleration_0_100),
            "range_km": self.range_km,
            "driven_km": self.driven_km,
            "battery_aviloo_score": self.battery_aviloo_score,
            "trunk_size_litre": self.trunk_size_litre,
            "full_insurance_year": self.full_insurance_year,
            "half_insurance_year": self.half_insurance_year,
            "car_tax_year": self.car_tax_year,
            "repairs_year": self.repairs_year,
            "body_style": self.body_style,
            "eu_segment": self.eu_segment,
            "suv_tier": self.suv_tier,
            "dc_peak_kw": _as_float(self.dc_peak_kw),
            "dc_time_min_10_80": _as_float(self.dc_time_min_10_80),
            "dc_time_source": self.dc_time_source,
            "ac_onboard_kw": _as_float(self.ac_onboard_kw),
            "ac_time_h_0_100": _as_float(self.ac_time_h_0_100),
            "ac_time_source": self.ac_time_source,
            # Derived/legacy passthroughs (if still used elsewhere)
            "tco_3_years": _as_float(self.tco_3_years),
            "tco_5_years": _as_float(self.tco_5_years),
            "tco_8_years": _as_float(self.tco_8_years),
            "insurance_cost": _as_float(self.insurance_cost),
            "tire_cost": _as_float(self.tire_cost),
            "car_tax": _as_float(self.car_tax),
            "consumption_cost": _as_float(self.consumption_cost),
        }

        # Include derived annual tires cost (display-only) if we know the yearly change fee
        try:
            change_fee = tire_change_price_year
            if change_fee is None:
                # Safe fallback: read AppSettings(1) if present; otherwise 0
                app = AppSettings.query.get(1)
                change_fee = (
                    Decimal(str(app.tire_change_price_year or 0)) if app else Decimal(0)
                )
            d["tires_year_effective"] = float(
                self.annual_tire_cost(Decimal(str(change_fee or 0)))
            )
        except Exception:
            # In case of session context issues, omit derived value rather than crashing
            d["tires_year_effective"] = None

        return d


# ============================ Settings =============================
class PriceSettings(db.Model):
    __tablename__ = "price_settings"
    id = db.Column(db.Integer, primary_key=True)
    el_price_ore_kwh = db.Column(db.Float, nullable=False, default=250.0)
    diesel_price_sek_litre = db.Column(db.Float, nullable=False, default=15.0)
    bensin_price_sek_litre = db.Column(db.Float, nullable=False, default=14.0)
    yearly_km = db.Column(db.Integer, nullable=False, default=18000)
    daily_commute_km = db.Column(db.Integer, nullable=False, default=30)
    downpayment_sek = db.Column(db.Float, nullable=False, default=0.0)  # absolute SEK
    interest_rate_pct = db.Column(db.Float, nullable=False, default=5.0)  # APR %

    def to_dict(self):
        return {
            "el_price_ore_kwh": self.el_price_ore_kwh,
            "diesel_price_sek_litre": self.diesel_price_sek_litre,
            "bensin_price_sek_litre": self.bensin_price_sek_litre,
            "yearly_km": self.yearly_km,
            "daily_commute_km": self.daily_commute_km,
            "downpayment_sek": self.downpayment_sek,
            "interest_rate_pct": self.interest_rate_pct,
        }


class AppSettings(db.Model):
    __tablename__ = "app_settings"
    id = db.Column(db.Integer, primary_key=True)  # always 1
    electricity_price_ore_kwh = db.Column(db.Integer, nullable=False, default=250)
    bensin_price_sek_litre = db.Column(db.Numeric(10, 2), nullable=False, default=14)
    diesel_price_sek_litre = db.Column(db.Numeric(10, 2), nullable=False, default=15)
    yearly_driving_km = db.Column(db.Integer, nullable=False, default=18000)
    daily_commute_km = db.Column(db.Integer, nullable=False, default=30)

    # global yearly tire change fee (mount/balance/storage if included)
    tire_change_price_year = db.Column(db.Numeric(10, 2), nullable=False, default=2000)

    @staticmethod
    def get_or_create():
        inst = AppSettings.query.get(1)
        if not inst:
            inst = AppSettings(id=1)
            db.session.add(inst)
            db.session.commit()
        return inst
