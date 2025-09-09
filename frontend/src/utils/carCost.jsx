// src/utils/carCost.js
// (pure JS, safe to use in Vite)

const COLORS = {
  great: "bg-emerald-50 text-emerald-700",
  good: "bg-green-50 text-green-700",
  ok: "bg-yellow-50 text-yellow-700",
  fair: "bg-amber-50 text-amber-700",
  bad: "bg-red-50 text-red-700",
};

export const fieldColor = (field, value) => {
  const v = Number(value) || 0;
  switch (field) {
    case "repairs_year":
      if (v > 7000) return COLORS.bad;
      if (v > 6000) return COLORS.fair;
      if (v > 5000) return COLORS.ok;
      if (v > 4000) return COLORS.good;
      return COLORS.great;

    case "trunk_size_litre":
      if (v > 500) return COLORS.good;
      if (v < 400) return COLORS.bad;
      return COLORS.ok;
    case "range":
      if (v > 500) return COLORS.good;
      if (v < 400) return COLORS.bad;
      return COLORS.ok;
    case "acceleration_0_100":
      if (v < 7) return COLORS.good;
      if (v > 9) return COLORS.bad;
      return COLORS.ok;
    case "full_insurance_year":
      if (v < 11000) return COLORS.good;
      if (v > 13000) return COLORS.bad;
      return COLORS.ok;
    case "half_insurance_year":
      if (v < 6000) return COLORS.good;
      if (v > 8000) return COLORS.bad;
      return COLORS.ok;
    case "car_tax_year":
      if (v < 1000) return COLORS.good;
      if (v > 2000) return COLORS.bad;
      return COLORS.ok;
    default:
      return "";
  }
};

export function NA({ hint }) {
  return (
    <span
      title={hint || "Not applicable"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: 12,
        background: "#f3f4f6",
        color: "#6b7280",
        border: "1px solid #e5e7eb",
      }}
    >
      N/A
    </span>
  );
}

// ------- helpers --------

const COMMUTE_DAYS_PER_MONTH = 22;

function num(x, d = 0) {
  const n = Number(
    String(x ?? "")
      .replace(",", ".")
      .trim(),
  );
  return Number.isFinite(n) ? n : d;
}

function normType(t) {
  const s = (t || "").toString().trim().toLowerCase();
  if (s === "bev" || s === "electric" || s === "ev") return "ev";
  if (s === "phev" || s.includes("plug")) return "phev";
  if (s.startsWith("d")) return "diesel";
  if (s.startsWith("b") || s.includes("petrol") || s.includes("gasoline"))
    return "bensin";
  return s || "ev";
}

// Get consumption with alias fallback
function kwhPer100(car) {
  const v =
    car?.consumption_kwh_100km ??
    car?.consumption_kwh_per_100km ??
    car?.consumption; // legacy
  const n = num(v, NaN);
  return Number.isFinite(n) ? n : null;
}

function lPer100(car) {
  const v =
    car?.consumption_l_100km ??
    car?.consumption_l_per_100km ??
    car?.l_per_100km; // legacy
  const n = num(v, NaN);
  return Number.isFinite(n) ? n : null;
}

// Normalize settings & sensible defaults
function normalizeSettings(settings) {
  const elOre = num(
    settings?.el_price_ore_kwh ?? settings?.electricity_price_ore_kwh,
    250,
  );
  const elecSEK = elOre / 100; // 250 öre => 2.50 SEK/kWh
  return {
    elecSEK,
    dieselSEK: num(settings?.diesel_price_sek_litre, 16.0),
    bensinSEK: num(settings?.bensin_price_sek_litre, 17.0),
    yearlyKM: num(settings?.yearly_km ?? settings?.yearly_driving_km, 18000),
    dailyCommuteKM: Math.max(0, num(settings?.daily_commute_km, 30)),
    // overheads/assumptions
    chargingLossPct: num(settings?.charging_loss_pct, 0.1), // +10% default
    tireLifespanYears: Math.max(1, num(settings?.tire_lifespan_years, 3)),
    phevElectricShare: undefined, // if provided, use; else derive from commute
    // depreciation (can be overridden from settings later if you add fields)
    dep3yPct: num(settings?.dep3yPct, 0.45),
    dep5yPct: num(settings?.dep5yPct, 0.6),
    dep8yPct: num(settings?.dep8yPct, 0.75),
  };
}

function seasonSplit(settings) {
  const winterMonths = num(settings?.winter_months, 5);
  const m = Math.max(0, Math.min(12, winterMonths));
  return { winter: m / 12, summer: 1 - m / 12 };
}

function wearMultiplier(car, settings) {
  const type = normType(car?.type_of_vehicle);
  const evMult = type === "ev" ? num(settings?.tire_wear_ev_mult, 1.15) : 1.0;
  const suvMult = car?.suv_tier ? num(settings?.tire_wear_suv_mult, 1.05) : 1.0;
  const perfCut = num(settings?.tire_wear_perf_mult_threshold_sec, 5.0);
  const perfMult =
    num(car?.acceleration_0_100, 9.0) <= perfCut
      ? num(settings?.tire_wear_perf_mult, 1.05)
      : 1.0;
  return evMult * suvMult * perfMult;
}

function yearlyTireCost(car, settings) {
  const ps = normalizeSettings(settings);
  const kmYear = num(ps?.yearlyKM, 18000);
  const { summer, winter } = seasonSplit(ps);
  const wearMult = wearMultiplier(car, ps);

  const priceSummer = num(car?.summer_tires_price, 0);
  const priceWinter = num(car?.winter_tires_price, 0);

  const lifeSummer = num(
    car?.summer_tire_life_km ?? ps?.summer_tire_life_km,
    40000,
  );
  const lifeWinter = num(
    car?.winter_tire_life_km ?? ps?.winter_tire_life_km,
    30000,
  );

  // Per-km cost per set (guard against 0)
  const cpkSummer = lifeSummer > 0 ? (priceSummer / lifeSummer) * wearMult : 0;
  const cpkWinter = lifeWinter > 0 ? (priceWinter / lifeWinter) * wearMult : 0;

  const costKm = kmYear * (summer * cpkSummer + winter * cpkWinter);

  const swaps = 2 * num(ps?.tire_swap_cost_per_change, 500); // spring + autumn
  const storage = num(ps?.tire_storage_cost_year, 0);

  return costKm + swaps + storage;
}

// ------- cost calc --------

/**
 * Monthly energy/fuel cost (SEK) given kmPerMonth and settings.
 * settings:
 *   - el_price_ore_kwh (öre)  → converted to SEK/kWh
 *   - diesel_price_sek_litre
 *   - bensin_price_sek_litre
 *   - daily_commute_km (for PHEV split)
 *   - charging_loss_pct (optional, default 0.10)
 */
export function monthlyConsumptionCost(car, kmPerMonth, settings) {
  const ps = normalizeSettings(settings);

  // Fall back to settings.yearly_km / 12 if caller passes nothing/0
  const fallbackKm = ps.yearlyKM / 12;
  const km = num(kmPerMonth, fallbackKm);
  if (!km) return 0;

  const type = normType(car?.type_of_vehicle);
  const sekPerKwh = ps.elecSEK * (1 + ps.chargingLossPct); // include charging overhead
  const dieselSekL = ps.dieselSEK;
  const bensinSekL = ps.bensinSEK;

  // EV: kWh only
  if (type === "ev") {
    const kwh100 = kwhPer100(car) ?? 0;
    if (!kwh100 || !sekPerKwh) return 0;
    return (km / 100) * kwh100 * sekPerKwh;
  }

  // PHEV: split electricity vs petrol
  if (type === "phev") {
    const consKwh100 = kwhPer100(car) ?? 0;
    const consL100 = lPer100(car) ?? 0;
    const battKwh = num(car?.battery_capacity_kwh, 0);

    if ((!consKwh100 || !sekPerKwh) && (!consL100 || !bensinSekL)) return 0;

    // derive electric-only range from battery/consumption (fallback 40 km)
    const assumedEvRange = 40;
    const evRange =
      consKwh100 > 0 && battKwh > 0
        ? (100 * battKwh) / consKwh100
        : assumedEvRange;

    // either use explicit share or compute from commute * working days
    const evKmPerDay = Math.min(ps.dailyCommuteKM, evRange);
    const evKmMonth =
      ps.phevElectricShare != null
        ? Math.max(0, Math.min(km, km * ps.phevElectricShare))
        : Math.min(evKmPerDay * COMMUTE_DAYS_PER_MONTH, km);

    let elCost = 0;
    if (consKwh100 > 0 && sekPerKwh > 0 && evKmMonth > 0) {
      const kwhPerKm = consKwh100 / 100;
      elCost = evKmMonth * kwhPerKm * sekPerKwh;
    }

    let fuelCost = 0;
    const fuelKm = Math.max(km - evKmMonth, 0);
    if (consL100 > 0 && bensinSekL > 0 && fuelKm > 0) {
      fuelCost = (fuelKm / 100) * consL100 * bensinSekL; // treat PHEV as petrol
    }

    return elCost + fuelCost;
  }

  // Diesel / Bensin: litres only
  const l100 = lPer100(car) ?? 0;
  if (!l100) return 0;

  const sekPerLitre =
    type === "diesel" ? dieselSekL : bensinSekL || dieselSekL || 0;
  if (!sekPerLitre) return 0;

  return (km / 100) * l100 * sekPerLitre;
}

/** Yearly energy/fuel cost, using monthlyConsumptionCost for consistency */
export function yearlyConsumptionCost(car, settings, kmPerYearOverride) {
  const ps = normalizeSettings(settings);
  const kmYear = num(kmPerYearOverride, ps.yearlyKM);
  return monthlyConsumptionCost(car, kmYear / 12, ps) * 12;
}

/** Yearly recurring cost: energy + insurance + tires amortized + tax + repairs */
export function yearlyRecurringCost(car, settings) {
  const ps = normalizeSettings(settings);

  const energyYear = yearlyConsumptionCost(car, ps);

  const insuranceYear =
    num(car?.full_insurance_year, NaN) ?? num(car?.half_insurance_year, NaN);
  const insY = Number.isFinite(insuranceYear) ? insuranceYear : 0;
  const tiresYear = yearlyTireCost(car, ps);
  const taxYear = num(car?.car_tax_year, 0);
  const repairsYear = num(car?.repairs_year, 0);

  return energyYear + insY + tiresYear + taxYear + repairsYear;
}

/**
 * Total Cost of Ownership for N years.
 * Includes depreciation + N * recurring yearly costs.
 * Default depreciation rates: 45% (3y), 60% (5y), 75% (8y).
 */
export function tco(car, settings, years = 3) {
  const ps = normalizeSettings(settings);
  const price = num(car?.estimated_purchase_price, 0);

  const depPct =
    years <= 3
      ? ps.dep3yPct
      : years <= 5
        ? ps.dep5yPct
        : years <= 8
          ? ps.dep8yPct
          : // simple extrapolation for >8y: cap at 90%
            Math.min(0.9, ps.dep8yPct + 0.03 * (years - 8));

  const dep = price * depPct;
  const recurring = yearlyRecurringCost(car, ps);
  return dep + years * recurring;
}

export const tco3 = (car, settings) => tco(car, settings, 3);
export const tco5 = (car, settings) => tco(car, settings, 5);
export const tco8 = (car, settings) => tco(car, settings, 8);
