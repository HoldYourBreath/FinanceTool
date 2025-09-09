// src/utils/tireEstimate.js

// tiny helpers (keep local to avoid coupling)
const toNum = (x, d = 0) => {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : d;
};
const normType = (t) => {
  const s = String(t || "")
    .trim()
    .toLowerCase();
  if (["ev", "bev", "electric"].includes(s)) return "ev";
  if (s.includes("plug") || s === "phev") return "phev";
  if (s.startsWith("d")) return "diesel";
  if (s.startsWith("b") || s.includes("petrol") || s.includes("gasoline"))
    return "bensin";
  return s || "ev";
};

const BASE_BY_TIER = {
  Subcompact: 7000,
  Compact: 9000,
  Midsize: 11000,
  Large: 13000,
};

// Optional: mild brand uplift for premium marques
const PREMIUM_BRANDS = new Set([
  "BMW",
  "Mercedes",
  "Audi",
  "Polestar",
  "Tesla",
  "Volvo",
]);

function brandFromModel(model) {
  const s = String(model || "")
    .trim()
    .toLowerCase();
  const first = s.split(/\s+/)[0] || "";
  // quick normalization
  const map = {
    vw: "Volkswagen",
    volkswagen: "Volkswagen",
    mb: "Mercedes",
    mercedes: "Mercedes",
    "mercedes-benz": "Mercedes",
  };
  const guess = map[first] || first.charAt(0).toUpperCase() + first.slice(1);
  return guess;
}

/**
 * Estimate tire set price for a car.
 * season: "summer" | "winter"
 */
export function estimateTireSetPrice(car, season = "summer") {
  const tier = String(car?.suv_tier || "").trim() || "Compact";
  let price = BASE_BY_TIER[tier] ?? 9000;

  // winter tires typically ~10% pricier
  if (season === "winter") price *= 1.1;

  // EVs often require higher load index → +5%
  const type = normType(car?.type_of_vehicle);
  if (type === "ev") price *= 1.05;

  // performance cars (0–100 ≤ 5.0s) → +10%
  const accel = toNum(car?.acceleration_0_100, 9);
  if (accel > 0 && accel <= 5.0) price *= 1.1;

  // premium brands tend to be pricier sizes/compounds
  const brand = brandFromModel(car?.model);
  if (PREMIUM_BRANDS.has(brand)) price *= 1.05;

  // round to nearest 100 SEK
  return Math.round(price / 100) * 100;
}

/** Optional: suggest lifespan (km) per season, adjusted for EV/SUV/perf */
export function suggestTireLifespanKm(car, season = "summer") {
  let life = season === "winter" ? 30000 : 40000;
  const type = normType(car?.type_of_vehicle);
  if (type === "ev") life *= 0.9; // heavier, instant torque
  if (String(car?.suv_tier || "")) life *= 0.95; // more mass/height
  const accel = toNum(car?.acceleration_0_100, 9);
  if (accel > 0 && accel <= 5.0) life *= 0.95; // spirited driving
  return Math.round(life / 500) * 500; // round to nearest 500 km
}
