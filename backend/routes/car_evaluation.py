from __future__ import annotations

from flask import Blueprint, jsonify, request
from utils.charging import estimate_ac_0_100_hours, estimate_dc_10_80_minutes
from utils.format import to_num
from utils.tco import compute_derived

from models.models import Car, db

cars_bp = Blueprint('cars', __name__, url_prefix='/api')


# ---------- GET /api/cars --------------------------------------------------
@cars_bp.get('/cars')
def get_cars():
    """List cars with optional filters and include derived fields.

    Query params (CSV allowed):
      - body_style=SUV,Sedan
      - eu_segment=C,D
      - suv_tier=Compact,Midsize
      - type_of_vehicle=EV,PHEV,Diesel,Bensin
      - q=substring_on_model
      - year_min=YYYY, year_max=YYYY
    """

    def parse_csv(name):
        raw = request.args.get(name)
        if not raw:
            return None
        return [v.strip() for v in raw.split(',') if v.strip()]

    q = Car.query

    body_styles = parse_csv('body_style')
    segments = parse_csv('eu_segment')
    suv_tiers = parse_csv('suv_tier')
    veh_types = parse_csv('type_of_vehicle')

    if body_styles:
        q = q.filter(Car.body_style.in_(body_styles))
    if segments:
        q = q.filter(Car.eu_segment.in_(segments))
    if suv_tiers:
        q = q.filter(Car.suv_tier.in_(suv_tiers))
    if veh_types:
        q = q.filter(Car.type_of_vehicle.in_(veh_types))

    term = request.args.get('q')
    if term:
        like = f'%{term}%'
        q = q.filter(Car.model.ilike(like))

    y_min = request.args.get('year_min', type=int)
    y_max = request.args.get('year_max', type=int)
    if y_min is not None:
        q = q.filter(Car.year >= y_min)
    if y_max is not None:
        q = q.filter(Car.year <= y_max)

    cars = q.order_by(Car.model.asc(), Car.year.desc()).all()

    resp = []
    for c in cars:
        d = {
            'id': c.id,
            'model': c.model,
            'year': int(to_num(c.year)),
            'type_of_vehicle': (c.type_of_vehicle or 'EV'),
            # categories
            'body_style': c.body_style,
            'eu_segment': c.eu_segment,
            'suv_tier': c.suv_tier,
            # pricing/specs
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
            'dc_peak_kw': to_num(getattr(c, 'dc_peak_kw', 0)),
            'dc_time_min_10_80': to_num(getattr(c, 'dc_time_min_10_80', 0)),
            'dc_time_min_10_80_est': to_num(getattr(c, 'dc_time_min_10_80_est', 0)),
            'dc_time_source': getattr(c, 'dc_time_source', '') or '',
            'ac_onboard_kw': to_num(getattr(c, 'ac_onboard_kw', 0)),
            'ac_time_h_0_100': to_num(getattr(c, 'ac_time_h_0_100', 0)),
            'ac_time_h_0_100_est': to_num(getattr(c, 'ac_time_h_0_100_est', 0)),
            'ac_time_source': getattr(c, 'ac_time_source', '') or '',
            # persisted TCO totals if present
            'tco_3_years': to_num(c.tco_3_years),
            'tco_5_years': to_num(c.tco_5_years),
            'tco_8_years': to_num(c.tco_8_years),
        }
        # computed dynamic fields
        d.update(compute_derived(c))
        if (d['dc_time_min_10_80'] or 0) <= 0:
            d['dc_time_min_10_80_est'] = (
                estimate_dc_10_80_minutes(d['battery_capacity_kwh'], d['dc_peak_kw'])
                or d['dc_time_min_10_80_est']
            )
        if (d['ac_time_h_0_100'] or 0) <= 0:
            d['ac_time_h_0_100_est'] = (
                estimate_ac_0_100_hours(d['battery_capacity_kwh'], d['ac_onboard_kw'])
                or d['ac_time_h_0_100_est']
            )

        resp.append(d)

    return jsonify(resp)


# ---------- GET /api/cars/categories --------------------------------------
@cars_bp.get('/cars/categories')
def car_categories():
    body_styles = [r[0] for r in db.session.query(Car.body_style).distinct() if r[0]]
    eu_segments = [r[0] for r in db.session.query(Car.eu_segment).distinct() if r[0]]
    suv_tiers = [r[0] for r in db.session.query(Car.suv_tier).distinct() if r[0]]
    return jsonify(
        {
            'body_styles': sorted(set(body_styles)),
            'eu_segments': sorted(set(eu_segments)),
            'suv_tiers': sorted(set(suv_tiers)),
        }
    )


# ---------- POST /api/cars/update -----------------------------------------
@cars_bp.post('/cars/update')
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

            # Basics
            car.model = p.get('model', car.model)
            car.year = int(to_num(p.get('year'), car.year or 0))
            car.type_of_vehicle = p.get('type_of_vehicle', getattr(car, 'type_of_vehicle', 'EV'))

            # Categories
            car.body_style = p.get('body_style', car.body_style)
            car.eu_segment = p.get('eu_segment', car.eu_segment)
            car.suv_tier = p.get('suv_tier', car.suv_tier)

            # Consumption
            car.consumption_kwh_per_100km = to_num(
                p.get('consumption_kwh_per_100km'), getattr(car, 'consumption_kwh_per_100km', 0)
            )
            if hasattr(car, 'consumption_l_per_100km'):
                car.consumption_l_per_100km = to_num(
                    p.get('consumption_l_per_100km'), getattr(car, 'consumption_l_per_100km', 0)
                )

            # Prices & specs
            car.estimated_purchase_price = to_num(
                p.get('estimated_purchase_price'), car.estimated_purchase_price or 0
            )
            car.summer_tires_price = to_num(
                p.get('summer_tires_price'), car.summer_tires_price or 0
            )
            car.winter_tires_price = to_num(
                p.get('winter_tires_price'), car.winter_tires_price or 0
            )

            car.range_km = int(to_num(p.get('range'), car.range_km or 0))
            car.acceleration_0_100 = to_num(
                p.get('acceleration_0_100'), car.acceleration_0_100 or 0
            )
            car.battery_capacity_kwh = to_num(
                p.get('battery_capacity_kwh'), car.battery_capacity_kwh or 0
            )
            car.trunk_size_litre = int(to_num(p.get('trunk_size_litre'), car.trunk_size_litre or 0))

            car.full_insurance_year = to_num(
                p.get('full_insurance_year'), car.full_insurance_year or 0
            )
            car.half_insurance_year = to_num(
                p.get('half_insurance_year'), car.half_insurance_year or 0
            )
            car.car_tax_year = to_num(p.get('car_tax_year'), car.car_tax_year or 0)
            car.repairs_year = to_num(p.get('repairs_year'), car.repairs_year or 0)

            car.dc_peak_kw = to_num(p.get('dc_peak_kw'), getattr(car, 'dc_peak_kw', 0))
            car.dc_time_min_10_80 = to_num(
                p.get('dc_time_min_10_80'), getattr(car, 'dc_time_min_10_80', 0)
            )
            car.dc_time_source = p.get('dc_time_source', getattr(car, 'dc_time_source', '') or '')

            car.ac_onboard_kw = to_num(p.get('ac_onboard_kw'), getattr(car, 'ac_onboard_kw', 0))
            car.ac_time_h_0_100 = to_num(
                p.get('ac_time_h_0_100'), getattr(car, 'ac_time_h_0_100', 0)
            )
            car.ac_time_source = p.get('ac_time_source', getattr(car, 'ac_time_source', '') or '')

            # Refresh estimates
            try:
                car.dc_time_min_10_80_est = estimate_dc_10_80_minutes(
                    to_num(car.battery_capacity_kwh), to_num(car.dc_peak_kw)
                )
                car.ac_time_h_0_100_est = estimate_ac_0_100_hours(
                    to_num(car.battery_capacity_kwh), to_num(car.ac_onboard_kw)
                )
            except Exception:
                pass

            # Persist derived totals if you denormalize them
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
