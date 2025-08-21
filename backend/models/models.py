from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Enum, Numeric
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql import func

db = SQLAlchemy()

vehicle_type_enum = SAEnum("EV", "Bensin", "Diesel",  'PHEV',
                           name="vehicle_type",
                           native_enum=True)

class Month(db.Model):
    __tablename__ = 'months'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    starting_funds = db.Column(db.Numeric, default=0)
    ending_funds = db.Column(db.Numeric, default=0)
    surplus = db.Column(db.Numeric, default=0)
    loan_remaining = db.Column(db.Numeric, default=0)
    is_current = db.Column(db.Boolean, default=False)
    month_date = db.Column(db.Date, nullable=True)
    incomes = db.relationship('Income', backref='month', lazy=True)
    expenses = db.relationship('Expense', backref='month', lazy=True)
    loan_adjustments = db.relationship('LoanAdjustment', backref='month', lazy=True)
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'startingFunds': float(self.starting_funds or 0),
            'endingFunds': float(self.ending_funds or 0),
            'surplus': float(self.surplus or 0),
            'loanRemaining': float(self.loan_remaining or 0),
            'incomes': [i.to_dict() for i in self.incomes],
            'expenses': [e.to_dict() for e in self.expenses],
            'loanAdjustments': [adj.to_dict() for adj in self.loan_adjustments],
        }


class Income(db.Model):
    __tablename__ = 'incomes'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    month_id = db.Column(db.Integer, db.ForeignKey('months.id'), nullable=False)
    source = db.Column(db.Text, nullable=True)
    amount = db.Column(db.Numeric, nullable=False)
    created_at = db.Column(db.DateTime, server_default=func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'amount': float(self.amount),
            'source': self.source
        }


class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(64), nullable=False)
    month_id = db.Column(db.Integer, db.ForeignKey('months.id'), nullable=False)
    description = db.Column(db.Text)
    amount = db.Column(db.Numeric, nullable=False)
    created_at = db.Column(db.DateTime, server_default=func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'description': self.description,
            'amount': float(self.amount) if self.amount is not None else 0,
        }



class LoanAdjustment(db.Model):
    __tablename__ = 'loan_adjustments'
    id = db.Column(db.Integer, primary_key=True)
    month_id = db.Column(db.Integer, db.ForeignKey('months.id'))
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(32))
    amount = db.Column(db.Numeric)
    note = db.Column(db.String(128))
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'amount': float(self.amount),
            'note': self.note
        }

class HouseCost(db.Model):
    __tablename__ = 'house_costs'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    amount = db.Column(db.Numeric, nullable=False)
    status = db.Column(Enum('done', 'todo', name='cost_status'), nullable=False, default='todo')
    created_at = db.Column(db.DateTime, server_default=func.now())


class LandCost(db.Model):
    __tablename__ = 'land_costs'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, nullable=False)
    amount = db.Column(db.Numeric, nullable=False)
    status = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, server_default=func.now())


class PlannedPurchase(db.Model):
    __tablename__ = 'planned_purchases'

    id = db.Column(db.Integer, primary_key=True)
    item = db.Column(db.String, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'item': self.item,
            'amount': self.amount,
            'date': self.date.isoformat() if self.date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Investment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    value = db.Column(db.Integer, nullable=False)
    paid = db.Column(db.Integer, nullable=False)
    rent = db.Column(db.Integer, nullable=False)

class AccInfo(db.Model):
    __tablename__ = 'acc_info'

    id = db.Column(db.Integer, primary_key=True)
    person = db.Column(db.String, nullable=False)
    bank = db.Column(db.String)
    acc_number = db.Column(db.String)
    country = db.Column(db.String)
    value = db.Column(db.Numeric)

class Financing(db.Model):
    __tablename__ = 'financing'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    value = db.Column(db.Numeric, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "value": float(self.value)
        }

class Car(db.Model):
    __tablename__ = 'cars'
    id = db.Column(db.Integer, primary_key=True)

    model = db.Column(db.String(255), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    estimated_purchase_price  = db.Column(db.Integer, default=0)
    summer_tires_price        = db.Column(db.Integer, default=0)
    winter_tires_price        = db.Column(db.Integer, default=0)
    consumption_kwh_per_100km = db.Column(db.Numeric(6,2), default=0)
    consumption_l_per_100km   = db.Column(db.Float, nullable=True, default=0.0)
    type_of_vehicle           = db.Column(vehicle_type_enum, nullable=False, server_default="EV")
    battery_capacity_kwh      = db.Column(db.Numeric(6,2), default=0)
    acceleration_0_100        = db.Column(db.Float)  # seconds 0–100 km/h
    range_km                  = db.Column(db.Integer, default=0)
    driven_km                 = db.Column(db.Integer, default=0)
    battery_aviloo_score      = db.Column(db.Integer, default=0)
    trunk_size_litre          = db.Column(db.Integer, default=0)
    full_insurance_year       = db.Column(db.Integer, default=0)
    half_insurance_year       = db.Column(db.Integer, default=0)
    car_tax_year              = db.Column(db.Integer, default=0)
    repairs_year              = db.Column(db.Integer, default=0)
    body_style                = db.Column(db.String(20), index=True) # e.g., 'SUV', 'Sedan'
    eu_segment                = db.Column(db.String(2), index=True) # e.g., 'B', 'C', 'D'
    suv_tier                  = db.Column(db.String(12), index=True)
    dc_peak_kw                = db.Column(db.Float)
    dc_time_min_10_80         = db.Column(db.Float)
    dc_time_min_10_80_est     = db.Column(db.Float)
    dc_time_source            = db.Column(db.Text)
    ac_onboard_kw             = db.Column(db.Float)
    ac_time_h_0_100           = db.Column(db.Float)
    ac_time_h_0_100_est       = db.Column(db.Float)
    ac_time_source            = db.Column(db.Text)

    # DERIVED (you can keep these or recompute on the fly)
    tco_3_years = db.Column(Numeric(12, 2), default=0)
    tco_5_years = db.Column(Numeric(12, 2), default=0)
    tco_8_years = db.Column(Numeric(12, 2), default=0)

    # LEGACY (safe to keep during transition)
    insurance_cost   = db.Column(Numeric(12, 2), default=0)
    tire_cost        = db.Column(Numeric(12, 2), default=0)
    car_tax          = db.Column(Numeric(12, 2), default=0)
    consumption_cost = db.Column(Numeric(12, 2), default=0)


class PriceSettings(db.Model):
    __tablename__ = 'price_settings'
    id = db.Column(db.Integer, primary_key=True)  # singleton row (id=1)
    el_price_ore_kwh = db.Column(db.Integer, nullable=False, default=250)   # öre/kWh
    diesel_price_sek_litre = db.Column(db.Float, nullable=False, default=15)
    bensin_price_sek_litre = db.Column(db.Float, nullable=False, default=14)
    yearly_km = db.Column(db.Integer, nullable=False, default=18000)
    daily_commute_km = db.Column(db.Integer, nullable=True, default=30)


class AppSettings(db.Model):
    __tablename__ = "app_settings"
    id = db.Column(db.Integer, primary_key=True)  # always 1
    electricity_price_ore_kwh = db.Column(db.Integer, nullable=False, default=250)
    bensin_price_sek_litre   = db.Column(db.Numeric(10,2), nullable=False, default=14)
    diesel_price_sek_litre   = db.Column(db.Numeric(10,2), nullable=False, default=15)
    yearly_driving_km        = db.Column(db.Integer, nullable=False, default=18000)
    daily_commute_km         = db.Column(db.Integer, nullable=False, default=140)

    @staticmethod
    def get_or_create():
        inst = AppSettings.query.get(1)
        if not inst:
            inst = AppSettings(id=1)
            db.session.add(inst)
            db.session.commit()
        return inst
