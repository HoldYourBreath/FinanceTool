// hooks/usePrices.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";

const DEFAULTS = {
  el_price_ore_kwh: 250,
  bensin_price_sek_litre: 14,
  diesel_price_sek_litre: 15,
  yearly_km: 18000,
  daily_commute_km: 30,
  downpayment_sek: 100000,
  interest_rate_pct: 5,
};

const toNum = (v) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? undefined
    : Number(v);

// Accept multiple possible server key styles
const normalizeServer = (d = {}) => ({
  // electricity
  el_price_ore_kwh:
    toNum(d.el_price_ore_kwh) ??
    toNum(d.electricity_price_ore_kwh) ??
    toNum(d.elPriceOreKwh) ??
    toNum(d.elOre),

  // fuels
  bensin_price_sek_litre:
    toNum(d.bensin_price_sek_litre) ?? toNum(d.petrol) ?? toNum(d.bensin),
  diesel_price_sek_litre: toNum(d.diesel_price_sek_litre) ?? toNum(d.diesel),

  // driving
  yearly_km: toNum(d.yearly_km) ?? toNum(d.yearlyKm) ?? toNum(d.yearly_driving_km),
  daily_commute_km:
    toNum(d.daily_commute_km) ?? toNum(d.daily_commute) ?? toNum(d.dailyCommuteKm),

  // financing
  downpayment_sek:
    toNum(d.downpayment_sek) ??
    toNum(d.downPaymentSek) ??
    toNum(d.downpayment) ??
    toNum(d.downPayment),
  interest_rate_pct:
    toNum(d.interest_rate_pct) ??
    toNum(d.interestRatePct) ??
    toNum(d.interest),
});

const coerceNumbers = (obj = {}) => ({
  el_price_ore_kwh: toNum(obj.el_price_ore_kwh),
  bensin_price_sek_litre: toNum(obj.bensin_price_sek_litre),
  diesel_price_sek_litre: toNum(obj.diesel_price_sek_litre),
  yearly_km: toNum(obj.yearly_km),
  daily_commute_km: toNum(obj.daily_commute_km),
  downpayment_sek: toNum(obj.downpayment_sek),
  interest_rate_pct: toNum(obj.interest_rate_pct),
});

// defaults < saved < db
const mergeSettings = ({ saved = {}, db = {} } = {}) =>
  coerceNumbers({ ...DEFAULTS, ...saved, ...db });

export default function usePrices(debounceMs = 500) {
  // one-time cleanup of any ancient persisted values
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("price_settings") || "{}");
      if (saved && saved.daily_commute_km === 140) {
        localStorage.removeItem("price_settings");
      }
    } catch {
      /* noop */
    }
  }, []);

  const initialSaved = (() => {
    try {
      return JSON.parse(localStorage.getItem("price_settings") || "{}");
    } catch {
      return {};
    }
  })();

  const [prices, setPrices] = useState(() => mergeSettings({ saved: initialSaved }));
  const [savingPrices, setSavingPrices] = useState(false);
  const timerRef = useRef(null);

  const loadPrices = useCallback(async () => {
    try {
      const { data } = await api.get("/settings/prices");
      const db = normalizeServer(data);
      setPrices((prev) => {
        const merged = mergeSettings({ saved: prev, db });
        localStorage.setItem("price_settings", JSON.stringify(merged));
        return merged;
      });
    } catch (e) {
      console.warn("Failed to load price settings; using saved/defaults", e);
    }
  }, []);

  // Debounced commit: send the whole merged object (server ignores unknowns)
  const commit = useCallback(async (payload) => {
    setSavingPrices(true);
    try {
      await api.patch("/settings/prices", payload);
    } finally {
      setSavingPrices(false);
    }
  }, []);

  // Optimistic local update so UI (TCO) reacts immediately
  const updatePrice = useCallback(
    (patch) => {
      setPrices((prev) => {
        const next = mergeSettings({ saved: { ...prev, ...patch } });
        localStorage.setItem("price_settings", JSON.stringify(next));
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => commit(next), debounceMs);
        return next;
      });
    },
    [commit, debounceMs],
  );

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  return { prices, updatePrice, savingPrices, loadPrices };
}
