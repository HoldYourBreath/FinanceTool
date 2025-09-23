// src/utils/carCalc.js
const n = (v, d = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};

function elecSekKwh(prices) {
  const ore = n(prices.el_price_ore_kwh, 250);
  const loss = 1 + n(prices.charging_loss_pct, 0.1);
  return (ore / 100) * loss;
}

function energyYear(car, prices) {
  const yearlyKm = n(prices.yearly_km, 18000);
  const type = (car.type_of_vehicle || "EV").toString();
  const kwh100 = n(car.consumption_kwh_per_100km, 0);
  const l100 = n(car.consumption_l_per_100km, 0);
  const el = elecSekKwh(prices);
  const bensin = n(prices.bensin_price_sek_litre, 18);
  const diesel = n(prices.diesel_price_sek_litre, 20);

  if (type === "EV") return (yearlyKm / 100) * kwh100 * el;
  if (type === "Diesel") return (yearlyKm / 100) * l100 * diesel;
  if (type === "Bensin") return (yearlyKm / 100) * l100 * bensin;
  if (type === "PHEV") {
    // simple split based on commute
    const commute = n(prices.daily_commute_km, 30);
    const batt = n(car.battery_capacity_kwh, 0);
    const evRange = batt > 0 && kwh100 > 0 ? (100 * batt) / kwh100 : 40;
    const evKmDay = Math.min(commute, evRange);
    const evShare =
      yearlyKm > 0 ? Math.min(1, Math.max(0, (evKmDay * 22) / yearlyKm)) : 0.6;
    const evPart = evShare * kwh100 * el;
    const icePart = (1 - evShare) * l100 * bensin;
    return (yearlyKm / 100) * (evPart + icePart);
  }
  return 0;
}

function tiresYear(car, prices) {
  const life = Math.max(1, n(prices.tire_lifespan_years, 3));
  const total = n(car.summer_tires_price, 0) + n(car.winter_tires_price, 0);
  return total > 0 ? total / life : 0;
}

function insuranceYear(car) {
  const full = n(car.full_insurance_year, 0);
  const half = n(car.half_insurance_year, 0);
  if (full > 0) return full;
  if (half > 0) return Math.round(half / 0.55);
  return 0;
}

function recurringYear(car, prices) {
  return (
    energyYear(car, prices) +
    tiresYear(car, prices) +
    insuranceYear(car) +
    n(car.car_tax_year, 0) +
    n(car.repairs_year, 0)
  );
}

function residuals(car, purchase) {
  const v3 =
    car.expected_value_after_3y != null
      ? n(car.expected_value_after_3y)
      : purchase * 0.55;
  const v5 =
    car.expected_value_after_5y != null
      ? n(car.expected_value_after_5y)
      : purchase * 0.4;
  const v8 =
    car.expected_value_after_8y != null
      ? n(car.expected_value_after_8y)
      : purchase * 0.25;
  return { v3, v5, v8 };
}

// Equal payment amortization: total + interest over `years`
function loanInterestOverYears(purchase, downpaymentSek, ratePct, years) {
  const principal = Math.max(n(purchase) - n(downpaymentSek), 0);
  const months = Math.max(years * 12, 1);
  const rAnnual = Math.max(n(ratePct), 0) / 100;
  if (principal <= 0) return { total: 0, interest: 0 };

  if (rAnnual <= 0) {
    const total = principal; // over the whole term for this horizon
    return { total, interest: 0 };
  }
  const r = rAnnual / 12;
  const monthly = principal * (r / (1 - Math.pow(1 + r, -months)));
  const total = monthly * months;
  return { total, interest: total - principal };
}

export function computeDerived(car, prices) {
  const purchase = n(car.estimated_purchase_price, 0);
  const recY = recurringYear(car, prices);

  const { v3, v5, v8 } = residuals(car, purchase);
  const dep3 = Math.max(0, purchase - v3);
  const dep5 = Math.max(0, purchase - v5);
  const dep8 = Math.max(0, purchase - v8);

  const down = n(prices.downpayment_sek, 0);
  const rate = n(prices.interest_rate_pct, 5);

  const L3 = loanInterestOverYears(purchase, down, rate, 3);
  const L5 = loanInterestOverYears(purchase, down, rate, 5);
  const L8 = loanInterestOverYears(purchase, down, rate, 8);

  // TCO = depreciation + recurring + downpayment (one-off) + interest (for horizon)
  const tco3 = dep3 + 3 * recY + down + L3.interest;
  const tco5 = dep5 + 5 * recY + down + L5.interest;
  const tco8 = dep8 + 8 * recY + down + L8.interest;

  return {
    energy_fuel_year: Math.round(energyYear(car, prices)),
    recurring_year: Math.round(recY),
    expected_value_after_3y: Math.round(v3),
    expected_value_after_5y: Math.round(v5),
    expected_value_after_8y: Math.round(v8),

    // totals with financing
    tco_total_3y: Math.round(tco3),
    tco_total_5y: Math.round(tco5),
    tco_total_8y: Math.round(tco8),

    // per-month
    tco_per_month_3y: Math.round(tco3 / 36),
    tco_per_month_5y: Math.round(tco5 / 60),
    tco_per_month_8y: Math.round(tco8 / 96),

    // for debugging/tooltip if needed
    finance_interest_3y: Math.round(L3.interest),
    finance_interest_5y: Math.round(L5.interest),
    finance_interest_8y: Math.round(L8.interest),
    downpayment_effective: down,
  };
}

export function recalcAll(cars, prices) {
  return (cars || []).map((c) => {
    const d = computeDerived(c, prices);
    return { ...c, ...d };
  });
}
