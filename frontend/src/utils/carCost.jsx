// src/utils/carCost.js
export const COLORS = {
  good: "bg-green-50 text-green-700",
  ok:   "bg-yellow-50 text-yellow-700",
  bad:  "bg-red-50 text-red-700",
};

export function fieldColor(field, value) {
  const v = Number(value) || 0;
  switch (field) {
    case "trunk_size_litre":
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
}

// Small "N/A" chip — REMOVE TS annotation, keep plain JS
export const NA = ({ hint }) => (
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

// ------------------ Consumption cost ------------------

const COMMUTE_DAYS_PER_MONTH = 22;

function toNum(v, fallback = 0) {
  const s = (v ?? "").toString().replace(/\s| /g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function normType(t) {
  const s = (t || "").toString().trim().toLowerCase();
  if (s === "bev" || s === "electric" || s === "ev") return "ev";
  if (s === "phev" || s.includes("plug")) return "phev";
  if (s.startsWith("d")) return "diesel";
  if (s.startsWith("b") || s.includes("petrol") || s.includes("gasoline"))
    return "bensin";
  return s;
}

/**
 * Compute monthly energy/fuel cost.
 * - EV: kWh/100 * el_price
 * - PHEV: split by commute — electric first (within EV range), remainder petrol
 * - Diesel/Bensin: L/100 * litre price
 *
 * settings:
 *   - el_price_ore_kwh  (öre/kWh)
 *   - diesel_price_sek_litre
 *   - bensin_price_sek_litre
 *   - daily_commute_km
 */
export function monthlyConsumptionCost(car, kmPerMonth, settings = {}) {
  const km = toNum(kmPerMonth, 0);
  const type = normType(car?.type_of_vehicle);

  const elPriceSEK = toNum(settings.el_price_ore_kwh, 0) / 100; // öre -> SEK
  const dieselSEK  = toNum(settings.diesel_price_sek_litre, 0);
  const bensinSEK  = toNum(settings.bensin_price_sek_litre, 0);
  const dailyCommuteKm = toNum(settings.daily_commute_km, 30);

  if (type === "ev") {
    const kwh100 = toNum(car?.consumption_kwh_per_100km, 0);
    return km * (kwh100 / 100) * elPriceSEK;
  }

  if (type === "phev") {
    const kwh100 = toNum(car?.consumption_kwh_per_100km, 0);
    const batt   = toNum(car?.battery_capacity_kwh, 0);
    const l100   = toNum(car?.consumption_l_per_100km, 0);

    // Estimate electric-only range for a full charge (fallback 40 km)
    const fallbackEvRange = 40;
    const evRangeKm =
      kwh100 > 0 && batt > 0 ? (100 * batt) / kwh100 : fallbackEvRange;

    const evKmPerDay = Math.min(dailyCommuteKm, evRangeKm);
    const evKmMonth  = Math.min(evKmPerDay * COMMUTE_DAYS_PER_MONTH, km);

    const kwhPerKm   = kwh100 / 100;
    const elCost     = evKmMonth * kwhPerKm * elPriceSEK;

    const fuelKm     = Math.max(km - evKmMonth, 0);
    const litres     = (l100 / 100) * fuelKm;
    const fuelCost   = litres * bensinSEK;

    return elCost + fuelCost;
  }

  // ICE: Diesel/Bensin
  const l100 = toNum(car?.consumption_l_per_100km, 0);
  const litrePrice = type === "diesel" ? dieselSEK : bensinSEK;
  return km * (l100 / 100) * litrePrice;
}
