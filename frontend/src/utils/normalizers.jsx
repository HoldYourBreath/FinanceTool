export const TYPE_CHOICES = ["EV", "PHEV", "Diesel", "Bensin"];

export function pickOfficialOrEst(official, est) {
  const o = Number(official) || 0;
  const e = Number(est) || 0;
  return { value: o > 0 ? o : e, isEst: !(o > 0) && e > 0 };
}

export function normType(t) {
  const s = (t || "").toString().trim().toLowerCase();
  if (s === "bev" || s === "electric" || s === "ev") return "ev";
  if (s === "phev" || s.includes("plug")) return "phev";
  if (s.startsWith("d")) return "diesel";
  if (s.startsWith("b") || s.includes("petrol") || s.includes("gasoline"))
    return "bensin";
  return s || "ev";
}
