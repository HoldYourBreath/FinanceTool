// src/utils/carCost.js
// (pure JS, safe to use in Vite)

const COLORS = {
  good: "bg-green-50 text-green-700",
  ok: "bg-yellow-50 text-yellow-700",
  bad: "bg-red-50 text-red-700",
};

export const fieldColor = (field, value) => {
  const v = Number(value) || 0;
  switch (field) {
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

// ------- cost calc --------

const COMMUTE_DAYS_PER_MONTH = 22;

function num(x, d = 0) {
  const n = Number(x);
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

/**
 * Monthly energy/fuel cost (SEK) given kmPerMonth and settings.
 * settings:
 *   - el_price_ore_kwh (öre)
 *   - diesel_price_sek_litre
 *   - bensin_price_sek_litre
 *   - daily_commute_km (for PHEV split)
 */
export function monthlyConsumptionCost(car, kmPerMonth, settings) {
  // Fall back to settings.yearly_km / 12 if caller passes nothing/0
  const fallbackKm = num(settings?.yearly_km, 0) / 12;
  const km = num(kmPerMonth, fallbackKm);
  if (!km) return 0;

  const type = normType(car.type_of_vehicle);

  const orePerKwh = num(settings?.el_price_ore_kwh, 0);
  const sekPerKwh = orePerKwh / 100; // öre -> SEK

  const dieselSekL = num(settings?.diesel_price_sek_litre, 0);
  const bensinSekL = num(settings?.bensin_price_sek_litre, 0);

  // EV: kWh only
  if (type === "ev") {
    const kwhPer100 = num(car.consumption_kwh_per_100km, 0);
    if (!kwhPer100 || !sekPerKwh) return 0;
    return (km / 100) * kwhPer100 * sekPerKwh;
  }

  // PHEV: part electricity (commute within electric-only range), rest petrol
  if (type === "phev") {
    const commuteKm = Math.max(0, num(settings?.daily_commute_km, 30));
    const consKwh100 = num(car.consumption_kwh_per_100km, 0);
    const consL100 = num(car.consumption_l_per_100km, 0);
    const battKwh = num(car.battery_capacity_kwh, 0);

    // if no inputs exist we can't compute anything sensible
    if ((!consKwh100 || !sekPerKwh) && (!consL100 || !bensinSekL)) return 0;

    // derive electric-only range from battery/consumption (fallback 40 km)
    const assumedEvRange = 40;
    const evRange =
      consKwh100 > 0 && battKwh > 0 ? (100 * battKwh) / consKwh100 : assumedEvRange;

    // how many km/month can we cover electrically
    const evKmPerDay = Math.min(commuteKm, evRange);
    const evKmMonth = Math.min(evKmPerDay * COMMUTE_DAYS_PER_MONTH, km);

    let elCost = 0;
    if (consKwh100 > 0 && sekPerKwh > 0) {
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
  const lPer100 = num(car.consumption_l_per_100km, 0);
  if (!lPer100) return 0;

  const sekPerLitre = type === "diesel" ? dieselSekL : bensinSekL || dieselSekL || 0;
  if (!sekPerLitre) return 0;

  return (km / 100) * lPer100 * sekPerLitre;
}
