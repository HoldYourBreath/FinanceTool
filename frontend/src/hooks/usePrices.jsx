// hooks/usePrices.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";

const DEFAULTS = {
  el_price_ore_kwh: 250,
  bensin_price_sek_litre: 14,
  diesel_price_sek_litre: 15,
  yearly_km: 18000,
  daily_commute_km: undefined,
};

const toNum = (v) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? undefined
    : Number(v);

// Accept multiple possible server key styles
const normalizeServer = (d = {}) => ({
  // also accept 'electricity_price_ore_kwh'
  el_price_ore_kwh: toNum(
    d.el_price_ore_kwh ??
      d.electricity_price_ore_kwh ??
      d.elPriceOreKwh ??
      d.elOre,
  ),
  bensin_price_sek_litre: toNum(
    d.bensin_price_sek_litre ?? d.petrol ?? d.bensin,
  ),
  diesel_price_sek_litre: toNum(d.diesel_price_sek_litre ?? d.diesel),
  // also accept 'yearly_driving_km'
  yearly_km: toNum(d.yearly_km ?? d.yearlyKm ?? d.yearly_driving_km),
  daily_commute_km: toNum(
    d.daily_commute_km ?? d.daily_commute ?? d.dailyCommuteKm,
  ),
});

const coerceNumbers = (obj = {}) => ({
  el_price_ore_kwh: toNum(obj.el_price_ore_kwh),
  bensin_price_sek_litre: toNum(obj.bensin_price_sek_litre),
  diesel_price_sek_litre: toNum(obj.diesel_price_sek_litre),
  yearly_km: toNum(obj.yearly_km),
  daily_commute_km: toNum(obj.daily_commute_km),
});

// defaults < saved < db
const mergeSettings = ({ saved = {}, db = {} } = {}) =>
  coerceNumbers({ ...DEFAULTS, ...saved, ...db });

export default function usePrices(debounceMs = 600) {
  // One-time cleanup: if a stale 140 is persisted, drop it once.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("price_settings") || "{}");
      if (saved && saved.daily_commute_km === 140) {
        localStorage.removeItem("price_settings");
      }
    } catch {
      void 0; // no-op to satisfy no-empty
    }
  }, []);

  const initialSaved = (() => {
    try {
      return JSON.parse(localStorage.getItem("price_settings") || "{}");
    } catch {
      void 0; // no-op to satisfy no-empty
      return {};
    }
  })();

  const [prices, setPrices] = useState(() =>
    mergeSettings({ saved: initialSaved }),
  );
  const [savingPrices, setSavingPrices] = useState(false);
  const timerRef = useRef(null);

  const loadPrices = useCallback(async () => {
    try {
      // Ensure this path matches your backend route
      const { data } = await api.get("/settings/prices");
      const db = normalizeServer(data);
      // Use functional setState to avoid stale 'prices' dependency
      setPrices((prev) => {
        const merged = mergeSettings({ saved: prev, db });
        localStorage.setItem("price_settings", JSON.stringify(merged));
        return merged;
      });
    } catch (e) {
      console.warn("Failed to load price settings; using saved/defaults", e);
    }
  }, []);

  const commit = useCallback(async (payload) => {
    setSavingPrices(true);
    try {
      await api.post("/settings/prices", payload);
    } finally {
      setSavingPrices(false);
    }
  }, []);

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

  // Cleanup any pending debounce timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { prices, updatePrice, savingPrices, loadPrices };
}
