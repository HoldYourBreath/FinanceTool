from flask import Blueprint, jsonify, request

from models.models import Car, PriceSettings, db

cars_bp = Blueprint('cars', __name__)

# ---- helpers -------------------------------------------------

def to_num(v, default=0.0):
    try:
        if v is None:
            return default
        if isinstance(v, (int, float)):
            return float(v)
        return float(str(v).replace(' ', '').replace('\u00A0', '').replace(',', '.'))
    except Exception:
        return default

def get_prices():
    """
    Load price settings on-demand (inside request context).
    Provides sane defaults if the row or fields are missing.
    """
    ps = PriceSettings.query.get(1)
    el_price_sek = ((ps.el_price_ore_kwh or 0) / 100.0) if ps and ps.el_price_ore_kwh is not None else 2.50
    diesel_sek_l = float(ps.diesel_price_sek_litre) if ps and ps.diesel_price_sek_litre is not None else 15.00
    bensin_sek_l = float(ps.bensin_price_sek_litre) if ps and ps.bensin_price_sek_litre is not None else 14.00
    yearly_km    = int(ps.yearly_km) if ps and ps.yearly_km else 18000
    daily_commute_km = int(getattr(ps, 'daily_commute_km', 30) or 30) 
    return {
        "el_price_sek": el_price_sek,
        "diesel_price_sek_litre": diesel_sek_l,
        "bensin_price_sek_litre": bensin_sek_l,
        "yearly_km": yearly_km,
        "daily_commute_km": daily_commute_km,
    }

DEFAULT_COMMUTE_DAYS_PER_MONTH = 22  # assumption

def energy_cost_per_month(car: Car):
    prices = get_prices()
    monthly_km = prices["yearly_km"] / 12.0
    vehicle_type = (car.type_of_vehicle or "EV").strip()

    # --- EV: kWh only
    if vehicle_type == "EV":
        kwh_per_month = (to_num(car.consumption_kwh_per_100km) / 100.0) * monthly_km
        return kwh_per_month * prices["el_price_sek"]

    # --- PHEV: part kWh (commute within electric range), rest bensin
    if vehicle_type.upper() == "PHEV":
        # derive electric range per full charge if possible
        cons_kwh_100 = to_num(car.consumption_kwh_per_100km)
        batt_kwh = to_num(car.battery_capacity_kwh)
        # fallback electric range if data missing
        assumed_ev_range_km = 40.0
        ev_range_km = (100.0 * batt_kwh / cons_kwh_100) if cons_kwh_100 > 0 and batt_kwh > 0 else assumed_ev_range_km

        daily_commute_km = float(prices["daily_commute_km"])
        commute_days = DEFAULT_COMMUTE_DAYS_PER_MONTH

        # km we can drive on electricity each commuting day
        ev_km_per_day = min(daily_commute_km, ev_range_km)

        # electric commuting km per month (cap by total monthly distance)
        ev_km_month = min(ev_km_per_day * commute_days, monthly_km)

        # Electricity used
        kwh_per_km = cons_kwh_100 / 100.0  # kWh per km
        kwh_month = ev_km_month * kwh_per_km
        el_cost = kwh_month * prices["el_price_sek"]

        # Remaining monthly km -> bensin
        l_per_100 = to_num(getattr(car, 'consumption_l_per_100km', 0.0))
        per_litre = prices["bensin_price_sek_litre"]  # treat PHEV as petrol
        fuel_km = max(monthly_km - ev_km_month, 0.0)
        litres = (l_per_100 / 100.0) * fuel_km
        fuel_cost = litres * per_litre

        return el_cost + fuel_cost

    # --- ICE fallback: Diesel vs Bensin
    l_per_100 = to_num(getattr(car, 'consumption_l_per_100km', 0.0))
    litres_per_month = (l_per_100 / 100.0) * monthly_km
    if vehicle_type == "Diesel":
        per_litre = prices["diesel_price_sek_litre"]
    else:
        per_litre = prices["bensin_price_sek_litre"]
    return litres_per_month * per_litre



DEPRECIATION_RATES = {3: 0.15, 5: 0.25, 8: 0.40}

def compute_derived(c: Car):
    """
    Uses settings lazily via get_prices(), so it only runs inside requests.
    """
    base = to_num(c.estimated_purchase_price)
    insurance_month = to_num(c.full_insurance_year) / 12.0
    car_tax_month   = to_num(c.car_tax_year) / 12.0
    repairs_month   = to_num(c.repairs_year) / 12.0
    tires_total     = to_num(c.summer_tires_price) + to_num(c.winter_tires_price)
    energy_month    = energy_cost_per_month(c)

    monthly_running_ex_tires = insurance_month + car_tax_month + repairs_month + energy_month
    out = {}

    for years in (3, 5, 8):
        months = years * 12
        expected_value = max(0.0, base * (1.0 - DEPRECIATION_RATES[years]))
        depreciation_amount = base - expected_value
        tires_per_month = tires_total / months if months else 0.0
        running_per_month = monthly_running_ex_tires + tires_per_month
        running_total = running_per_month * months
        tco_total = running_total + depreciation_amount
        tco_per_month = tco_total / months if months else 0.0

        out[f'expected_value_after_{years}y'] = expected_value
        out[f'tco_total_{years}y'] = tco_total
        out[f'tco_per_month_{years}y'] = tco_per_month

    return out

# ---- routes --------------------------------------------------

@cars_bp.route('/api/cars', methods=['GET'])
def get_cars():
    cars = Car.query.all()
    resp = []
    for c in cars:
        d = {
            'id': c.id,
            'model': c.model,
            'year': int(to_num(c.year)),
            'type_of_vehicle': (c.type_of_vehicle or 'EV'),
            'estimated_purchase_price': to_num(c.estimated_purchase_price),

            'summer_tires_price': to_num(c.summer_tires_price),
            'winter_tires_price': to_num(c.winter_tires_price),

            'consumption_kwh_per_100km': to_num(c.consumption_kwh_per_100km),
            'consumption_l_per_100km': to_num(getattr(c, 'consumption_l_per_100km', 0.0)),

            'range': to_num(c.range_km),
            'acceleration_0_100': to_num(c.acceleration_0_100),
            'battery_capacity_kwh': to_num(c.battery_capacity_kwh),
            'trunk_size_litre': to_num(c.trunk_size_litre),

            'full_insurance_year': to_num(c.full_insurance_year),
            'half_insurance_year': to_num(c.half_insurance_year),
            'car_tax_year': to_num(c.car_tax_year),
            'repairs_year': to_num(c.repairs_year),

            'tco_3_years': to_num(c.tco_3_years),
            'tco_5_years': to_num(c.tco_5_years),
            'tco_8_years': to_num(c.tco_8_years),
        }
        d.update(compute_derived(c))
        resp.append(d)
    return jsonify(resp)

@cars_bp.route('/api/cars/update', methods=['POST'])
def update_cars():
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, list):
            return jsonify({'error': 'Expected a JSON list'}), 400

        updated = 0
        for p in data:
            car = Car.query.get(p.get('id'))
            if not car:
                continue

            car.model  = p.get('model', car.model)
            car.year   = int(to_num(p.get('year'), car.year or 0))

            # Vehicle type & consumption fields
            car.type_of_vehicle = p.get('type_of_vehicle', getattr(car, 'type_of_vehicle', 'EV'))
            car.consumption_kwh_per_100km = to_num(p.get('consumption_kwh_per_100km'), getattr(car, 'consumption_kwh_per_100km', 0))
            if hasattr(car, 'consumption_l_per_100km'):
                car.consumption_l_per_100km = to_num(p.get('consumption_l_per_100km'), getattr(car, 'consumption_l_per_100km', 0))

            # Prices & specs
            car.estimated_purchase_price = to_num(p.get('estimated_purchase_price'), car.estimated_purchase_price or 0)
            car.summer_tires_price       = to_num(p.get('summer_tires_price'), car.summer_tires_price or 0)
            car.winter_tires_price       = to_num(p.get('winter_tires_price'), car.winter_tires_price or 0)

            car.range_km                 = int(to_num(p.get('range'), car.range_km or 0))
            car.acceleration_0_100       = to_num(p.get('acceleration_0_100'), car.acceleration_0_100 or 0)
            car.battery_capacity_kwh     = to_num(p.get('battery_capacity_kwh'), car.battery_capacity_kwh or 0)
            car.trunk_size_litre         = int(to_num(p.get('trunk_size_litre'), car.trunk_size_litre or 0))

            car.full_insurance_year      = to_num(p.get('full_insurance_year'), car.full_insurance_year or 0)
            car.half_insurance_year      = to_num(p.get('half_insurance_year'), car.half_insurance_year or 0)
            car.car_tax_year             = to_num(p.get('car_tax_year'), car.car_tax_year or 0)
            car.repairs_year             = to_num(p.get('repairs_year'), car.repairs_year or 0)

            # Persist derived totals if you keep them denormalized
            d = compute_derived(car)
            car.tco_3_years = d['tco_total_3y']
            car.tco_5_years = d['tco_total_5y']
            car.tco_8_years = d['tco_total_8y']

            updated += 1

        db.session.commit()
        return jsonify({'updated': updated, 'message': 'Cars updated'}), 200
    except Exception as e:
        print('❌ /api/cars/update error:', e)
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500
