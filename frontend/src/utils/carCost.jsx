// src/utils/carCost.js
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

// Fuel/energy cost per month based on vehicle type and settings
export function monthlyConsumptionCost(car, kmPerMonth, settings) {
  const kmFactor = (Number(kmPerMonth) || 0) / 100;

  const typeRaw = (car.type_of_vehicle ?? "").trim().toLowerCase();
  const type = typeRaw === "bev" || typeRaw === "electric" ? "ev" : typeRaw;

  if (type === "ev") {
    const kwhPer100 = Number(car.consumption_kwh_per_100km) || 0;
    const sekPerKwh = (Number(settings.el_price_ore_kwh) || 0) / 100; // öre -> SEK
    return kmFactor * kwhPer100 * sekPerKwh;
  }

  // litres: prefer API key; if it's 0/missing fall back to alternates
  const lPer100 =
    Number(car.consumption_l_per_100km) ||
    Number(car.consumption_l_100km) ||
    Number(car.consumption_kwh_per_100km) ||
    0;

  const isDiesel = type.includes("diesel") || type === "d";
  const isBensin =
    type.includes("bensin") ||
    type.includes("PHEV") ||
    type.includes("petrol") ||
    type.includes("gasoline") ||
    type === "b";

  const diesel = Number(settings.diesel_price_sek_litre ?? 0);
  const bensin = Number(settings.bensin_price_sek_litre ?? 0);

  const sekPerLitre = isDiesel
    ? diesel
    : isBensin
      ? bensin
      : bensin || diesel || 0;
  return kmFactor * lPer100 * sekPerLitre;
}
