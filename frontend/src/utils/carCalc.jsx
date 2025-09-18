// src/utils/carCalc.jsx
// Frontend TCO math with financing + depreciation done right.

import { normType } from "./normalizers";

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// ---- Energy / fuel ---------------------------------------------------------
export function energyFuelCostYear(car = {}, prices = {}) {
  const yearlyKm = num(prices.yearly_km, 18000);
  const kwh100   = num(car.consumption_kwh_per_100km, 0);
  const l100     = num(car.consumption_l_per_100km, 0);

  const elecSekPerKwh = num(prices.el_price_ore_kwh, 250) / 100; // öre → SEK
  const bensinSekL = num(prices.bensin_price_sek_litre, 18);
  const dieselSekL = num(prices.diesel_price_sek_litre, 20);

  if (yearlyKm <= 0) return 0;

  const t = normType(car.type_of_vehicle);
  if (t === "ev")     return (yearlyKm / 100) * kwh100 * elecSekPerKwh;
  if (t === "diesel") return (yearlyKm / 100) * l100   * dieselSekL;
  if (t === "bensin") return (yearlyKm / 100) * l100   * bensinSekL;
  if (t === "phev") {
    // crude PHEV split based on daily commute vs. electric range
    const daily = num(prices.daily_commute_km, 30);
    const battKwh = num(car.battery_capacity_kwh, 0);
    const evRangeKm = battKwh > 0 && kwh100 > 0 ? (100 * battKwh) / kwh100 : 40;
    const evKmPerDay = Math.min(daily, evRangeKm);
    const evShare = yearlyKm > 0 ? Math.min(1, Math.max(0, (evKmPerDay * 22) / yearlyKm)) : 0.6;

    const evPart  = evShare     * kwh100 * elecSekPerKwh;
    const icePart = (1-evShare) * l100   * bensinSekL;
    return (yearlyKm / 100) * (evPart + icePart);
  }
  return 0;
}

// ---- Recurring costs (yearly) ----------------------------------------------
function tiresPerYear(car = {}, prices = {}) {
  // amortize summer + winter over lifespan (default 3y)
  const lifespan = Math.max(1, num(prices.tire_lifespan_years, 3));
  const total = num(car.summer_tires_price, 0) + num(car.winter_tires_price, 0);
  return total > 0 ? total / lifespan : 0;
}
function insurancePerYear(car = {}) {
  const full = num(car.full_insurance_year, 0);
  const half = num(car.half_insurance_year, 0);
  return full > 0 ? full : half; // prefer full if provided
}
function recurringCostYear(car = {}, prices = {}) {
  return (
    energyFuelCostYear(car, prices) +
    tiresPerYear(car, prices) +
    insurancePerYear(car) +
    num(car.car_tax_year, 0) +
    num(car.repairs_year, 0)
  );
}

// ---- Financing --------------------------------------------------------------
export function financingTotals(purchasePrice, downpaymentSek, interestRatePct, years) {
  const principal = Math.max(num(purchasePrice, 0) - num(downpaymentSek, 0), 0);
  const n = Math.max(1, num(years, 0) * 12);
  const rMonthly = Math.max(0, num(interestRatePct, 0)) / 100 / 12;

  if (principal <= 0) return { monthly: 0, totalPaid: 0, interestTotal: 0 };
  if (rMonthly === 0) {
    const monthly = principal / n;
    return { monthly, totalPaid: principal, interestTotal: 0 };
  }
  const monthly = principal * (rMonthly / (1 - Math.pow(1 + rMonthly, -n)));
  const totalPaid = monthly * n;
  return { monthly, totalPaid, interestTotal: totalPaid - principal };
}

// ---- Depreciation via residual values --------------------------------------
function residuals(car, purchase) {
  // use explicit fields if present; else sensible defaults
  const v3 = car.expected_value_after_3y ?? purchase * 0.55; // ~45% dep after 3y
  const v5 = car.expected_value_after_5y ?? purchase * 0.40; // ~60% dep after 5y
  const v8 = car.expected_value_after_8y ?? purchase * 0.25; // ~75% dep after 8y
  return { v3: num(v3, 0), v5: num(v5, 0), v8: num(v8, 0) };
}

// ---- Main recompute for a single car ---------------------------------------
export function recalcForCar(car = {}, prices = {}) {
  const purchase = num(car.estimated_purchase_price, 0);

  const recurY = recurringCostYear(car, prices);

  // financing interest for each term (only the INTEREST is a cost; principal is
  // already represented by depreciation: purchase - residual)
  const fin3 = financingTotals(purchase, prices.downpayment_sek, prices.interest_rate_pct, 3).interestTotal;
  const fin5 = financingTotals(purchase, prices.downpayment_sek, prices.interest_rate_pct, 5).interestTotal;
  const fin8 = financingTotals(purchase, prices.downpayment_sek, prices.interest_rate_pct, 8).interestTotal;

  const { v3, v5, v8 } = residuals(car, purchase);
  const dep3 = Math.max(0, purchase - v3);
  const dep5 = Math.max(0, purchase - v5);
  const dep8 = Math.max(0, purchase - v8);

  const tcoTotal3 = dep3 + fin3 + 3 * recurY;
  const tcoTotal5 = dep5 + fin5 + 5 * recurY;
  const tcoTotal8 = dep8 + fin8 + 8 * recurY;

  return {
    ...car,

    // expose the building blocks
    energy_fuel_year: Math.round(energyFuelCostYear(car, prices)),
    recurring_year:   Math.round(recurY),

    // totals
    tco_total_3y: Math.round(tcoTotal3),
    tco_total_5y: Math.round(tcoTotal5),
    tco_total_8y: Math.round(tcoTotal8),

    // per-month convenience
    tco_per_month_3y: Math.round(tcoTotal3 / 36),
    tco_per_month_5y: Math.round(tcoTotal5 / 60),
    tco_per_month_8y: Math.round(tcoTotal8 / 96),

    // legacy aliases some components/columns might still use
    tco_3_years: Math.round(tcoTotal3),
    tco_5_years: Math.round(tcoTotal5),
    tco_8_years: Math.round(tcoTotal8),
  };
}

// ---- Map version for arrays -------------------------------------------------
export function recalcAll(cars = [], prices = {}) {
  return cars.map((c) => recalcForCar(c, prices));
}
