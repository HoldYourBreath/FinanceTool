// src/utils/carCalc.js
// Recompute derived fields (energy, recurring, financing-aware TCO) on the client.
// This mirrors the backend logic and is triggered by prices changing.

// src/utils/carCalc.jsx

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const normType = (t) => {
  const s = String(t || "").trim().toLowerCase();
  if (s === "ev" || s === "bev" || s === "electric") return "ev";
  if (s === "phev" || s.includes("plug")) return "phev";
  if (s.startsWith("diesel")) return "diesel";
  if (s.startsWith("bensin") || s.includes("petrol") || s.includes("gasoline")) return "bensin";
  return "ev";
};

/**
 * Compute yearly energy/fuel cost in SEK, given a car row and current prices.
 * - Electricity price is provided in öre/kWh; we convert to SEK/kWh.
 * - For PHEV we split commute between electric and petrol based on a simple heuristic.
 */
export function energyFuelCostYear(car = {}, prices = {}) {
  const yearlyKm = num(prices.yearly_km, 18000);
  const kwh100   = num(car.consumption_kwh_per_100km, 0);
  const l100     = num(car.consumption_l_per_100km, 0);

  const elecSekPerKwh = num(prices.el_price_ore_kwh, 250) / 100; // 250 öre -> 2.50 SEK
  const bensinSekL = num(prices.bensin_price_sek_litre, 18);
  const dieselSekL = num(prices.diesel_price_sek_litre, 20);

  const t = normType(car.type_of_vehicle);

  if (yearlyKm <= 0) return 0;

  if (t === "ev") {
    return (yearlyKm / 100) * kwh100 * elecSekPerKwh;
  }
  if (t === "diesel") {
    return (yearlyKm / 100) * l100 * dieselSekL;
  }
  if (t === "bensin") {
    return (yearlyKm / 100) * l100 * bensinSekL;
  }
  if (t === "phev") {
    // crude split: how much of daily commute can be electric
    const daily = num(prices.daily_commute_km, 30);
    const battKwh = num(car.battery_capacity_kwh, 0);
    const evRangeKm = battKwh > 0 && kwh100 > 0 ? (100 * battKwh) / kwh100 : 40;
    const evKmPerDay = Math.min(daily, evRangeKm);
    const evShare = yearlyKm > 0 ? Math.min(1, Math.max(0, (evKmPerDay * 22) / yearlyKm)) : 0.6;

    const evPart  = evShare * kwh100 * elecSekPerKwh;
    const icePart = (1 - evShare) * l100 * bensinSekL;

    return (yearlyKm / 100) * (evPart + icePart);
  }

  // default to zero if unknown
  return 0;
}


const clampNum = (v, d = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : d;

// ---- financing: standard amortization ----
function amortizeTotal(principal, annualPct, years) {
  const P = Math.max(0, Number(principal) || 0);
  const n = Math.max(1, Math.round(years * 12));
  const rAnnual = Math.max(0, Number(annualPct) || 0) / 100;

  if (P <= 0) return { totalPaid: 0, interestPaid: 0 };

  if (rAnnual === 0) {
    const totalPaid = P; // equal monthly, no interest
    return { totalPaid, interestPaid: 0 };
  }
  const r = rAnnual / 12;
  const monthly = P * (r / (1 - Math.pow(1 + r, -n)));
  const totalPaid = monthly * n;
  return { totalPaid, interestPaid: totalPaid - P };
}

// ---- simple fallbacks for fixed costs when car lacks values ----
function estimateFullInsuranceYear(price, type) {
  const base = type === "EV" ? 4000 : 5000;
  const rate = type === "EV" ? 0.020 : 0.022;
  const guess = base + rate * price;
  return Math.max(7000, Math.min(15000, guess));
}

function estimateHalfFromFull(full) {
  return Math.round(full * 0.55);
}

function estimateTaxYear(type) {
  return type === "EV" ? 360 : 1600;
}

function estimateRepairsYear(type, carYear) {
  const y = new Date().getFullYear();
  const age = Math.max(0, (carYear ? (y - Number(carYear)) : 0));
  const base = type === "EV" ? 3000 : 5000;
  return base + Math.max(0, age - 5) * 300;
}

// ---- energy per year ----
function energyYear(car, P) {
  const type = normType(car.type_of_vehicle);
  const kwh100 = clampNum(car.consumption_kwh_per_100km ?? car.consumption_kwh_100km, 0);
  const l100   = clampNum(car.consumption_l_per_100km, 0);
  const km     = clampNum(P.yearly_km, 18000);

  if (type === "EV") {
    return (km / 100) * kwh100 * P.elec_sek_kwh;
  }
  if (type === "Diesel") {
    return (km / 100) * l100 * P.diesel_sek_l;
  }
  if (type === "Bensin") {
    return (km / 100) * l100 * P.bensin_sek_l;
  }
  if (type === "PHEV") {
    // Split usage between EV and ICE for commute; heuristic similar to backend
    const batt = clampNum(car.battery_capacity_kwh, 0);
    const evRangeKm = (batt > 0 && kwh100 > 0) ? (100 * batt / kwh100) : 40;
    const evKmDay = Math.min(clampNum(P.daily_commute_km, 30), evRangeKm);
    const evShare = km > 0 ? Math.min(1, Math.max(0, (evKmDay * 22) / km)) : 0.6;
    const evPart  = evShare     * kwh100 * P.elec_sek_kwh;
    const icePart = (1-evShare) * l100   * P.bensin_sek_l;
    return (km / 100) * (evPart + icePart);
  }
  return 0;
}

// ---- one car compute ----
function computeOne(car, prices) {
  // Normalize prices for calc
  const elecLoss = 1.10; // 10% charging loss
  const P = {
    elec_sek_kwh: (clampNum(prices.el_price_ore_kwh, 250) / 100) * elecLoss,
    diesel_sek_l: clampNum(prices.diesel_price_sek_litre, 15),
    bensin_sek_l: clampNum(prices.bensin_price_sek_litre, 14),
    yearly_km: Math.round(clampNum(prices.yearly_km, 18000)),
    daily_commute_km: Math.round(clampNum(prices.daily_commute_km, 30)),
    tire_lifespan_years: Math.max(1, Math.round(clampNum(prices.tire_lifespan_years, 3))),
    downpayment_sek: Math.max(0, clampNum(prices.downpayment_sek, 0)),
    interest_rate_pct: Math.max(0, clampNum(prices.interest_rate_pct, 5)),
  };

  const type = normType(car.type_of_vehicle);
  const price = clampNum(car.estimated_purchase_price, 0);

  // Energy
  const energyY = energyYear(car, P);

  // Tires over lifespan (summer + winter)
  const tireTotal = clampNum(car.summer_tires_price, 0) + clampNum(car.winter_tires_price, 0);
  const tiresY = tireTotal > 0 ? tireTotal / P.tire_lifespan_years : 0;

  // Insurance (prefer full, else derive from half, else estimate)
  const fullRaw = clampNum(car.full_insurance_year, 0);
  const halfRaw = clampNum(car.half_insurance_year, 0);
  const fullEff = fullRaw > 0 ? fullRaw : (halfRaw > 0 ? Math.round(halfRaw / 0.55) : estimateFullInsuranceYear(price, type));
  const halfEff = estimateHalfFromFull(fullEff);

  const taxEff = clampNum(car.car_tax_year, 0) || estimateTaxYear(type);
  const repairsEff = clampNum(car.repairs_year, 0) || estimateRepairsYear(type, car.year);

  const recurringY = energyY + tiresY + fullEff + taxEff + repairsEff;

  // Depreciation (fallback rates if not provided)
  const dep3 = 0.45 * price;
  const dep5 = 0.60 * price;
  const dep8 = 0.75 * price;

  // Financing
  const principal = Math.max(price - P.downpayment_sek, 0);
  const i3 = amortizeTotal(principal, P.interest_rate_pct, 3).interestPaid;
  const i5 = amortizeTotal(principal, P.interest_rate_pct, 5).interestPaid;
  const i8 = amortizeTotal(principal, P.interest_rate_pct, 8).interestPaid;

  // We include downpayment (cash out today) + interest (cost of financing).
  // We do NOT include principal again to avoid double counting with depreciation.
  const financed3 = P.downpayment_sek + i3;
  const financed5 = P.downpayment_sek + i5;
  const financed8 = P.downpayment_sek + i8;

  const tco3 = dep3 + 3 * recurringY + financed3;
  const tco5 = dep5 + 5 * recurringY + financed5;
  const tco8 = dep8 + 8 * recurringY + financed8;

  return {
    energy_cost_month: round2(energyY / 12),
    recurring_per_year: round2(recurringY),

    // expose effective yearly parts
    tires_year_effective: round2(tiresY),
    full_insurance_year_effective: round2(fullEff),
    half_insurance_year_effective: round2(halfEff),
    car_tax_year_effective: round2(taxEff),
    repairs_year_effective: round2(repairsEff),

    // financing parts (for tooltips/debug)
    financed_3y_interest: round2(i3),
    financed_5y_interest: round2(i5),
    financed_8y_interest: round2(i8),
    downpayment_sek: round2(P.downpayment_sek),
    interest_rate_pct: round2(P.interest_rate_pct),

    // totals (match keys the UI sorts by)
    tco_total_3y: Math.round(tco3),
    tco_total_5y: Math.round(tco5),
    tco_total_8y: Math.round(tco8),
    tco_per_month_3y: Math.round(tco3 / 36),
    tco_per_month_5y: Math.round(tco5 / 60),
    tco_per_month_8y: Math.round(tco8 / 96),

    // legacy aliases some components may read
    tco_3_years: Math.round(tco3),
    tco_5_years: Math.round(tco5),
    tco_8_years: Math.round(tco8),
  };
}

const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100;

// Public API: recompute all cars with current prices
export function recalcAll(cars = [], prices = {}) {
  return (cars || []).map((c) => {
    const derived = computeOne(c, prices);
    return { ...c, ...derived };
  });
}
