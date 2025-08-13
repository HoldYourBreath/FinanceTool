// src/utils/format.js
export const toFixed1 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : "";
};

export const toNum = (v) => {
  const n = typeof v === "string" ? v.replace(",", ".") : v;
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const fmt0 = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString("sv-SE", { maximumFractionDigits: 0 })
    : "0";
