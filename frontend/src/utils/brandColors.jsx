// src/utils/brandColors.js

// Canonical brand by common aliases (start-of-string match)
const ALIASES = {
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  skoda: "Skoda",
  tesla: "Tesla",
  bmw: "BMW",
  audi: "Audi",
  volvo: "Volvo",
  kia: "Kia",
  hyundai: "Hyundai",
  nissan: "Nissan",
  toyota: "Toyota",
  ford: "Ford",
  peugeot: "Peugeot",
  citroen: "Citroen",
  mg: "MG",
  byd: "BYD",
  cupra: "Cupra",
  mini: "Mini",
  mercedes: "Mercedes",
  "mercedes-benz": "Mercedes",
  mb: "Mercedes",
  polestar: "Polestar",
  xpeng: "Xpeng",
  mazda: "Mazda",
};

const BRAND_BG = {
  Skoda: "bg-emerald-50/80 ring-1 ring-emerald-200",
  Volkswagen: "bg-sky-50/80     ring-1 ring-sky-200",
  Tesla: "bg-red-50/80     ring-1 ring-red-200",
  BMW: "bg-blue-50/80    ring-1 ring-blue-200",
  Audi: "bg-rose-50/80    ring-1 ring-rose-200",
  Volvo: "bg-indigo-50/80  ring-1 ring-indigo-200",
  Kia: "bg-rose-50/80    ring-1 ring-rose-200",
  Hyundai: "bg-blue-50/80    ring-1 ring-blue-200",
  Nissan: "bg-rose-50/80    ring-1 ring-rose-200",
  Toyota: "bg-red-50/80     ring-1 ring-red-200",
  Ford: "bg-blue-50/80    ring-1 ring-blue-200",
  Peugeot: "bg-indigo-50/80  ring-1 ring-indigo-200",
  Citroen: "bg-rose-50/80    ring-1 ring-rose-200",
  MG: "bg-rose-50/80    ring-1 ring-rose-200",
  BYD: "bg-red-50/80     ring-1 ring-red-200",
  Cupra: "bg-amber-50/80   ring-1 ring-amber-200",
  Mini: "bg-yellow-50/80  ring-1 ring-yellow-200",
  Mercedes: "bg-slate-50/80   ring-1 ring-slate-200",
  Polestar: "bg-zinc-50/80    ring-1 ring-zinc-200",
  Xpeng: "bg-teal-50/80    ring-1 ring-teal-200",
  Mazda: "bg-red-50/80     ring-1 ring-red-200",
};

export function canonicalBrand(model) {
  const s = String(model || "")
    .trim()
    .toLowerCase();
  // check multi-word aliases first (e.g. "mercedes-benz")
  const aliases = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
  for (const a of aliases) {
    if (s.startsWith(a + " ") || s === a) return ALIASES[a];
  }
  return null;
}

export function brandBgClass(model) {
  const b = canonicalBrand(model);
  return b && BRAND_BG[b] ? BRAND_BG[b] : "bg-white";
}
