import { useCallback, useRef, useState } from "react";
import api from "../api/axios";

export default function usePrices(debounceMs = 600) {
  const [prices, setPrices] = useState({ el_price_ore_kwh: 250, bensin_price_sek_litre: 14, diesel_price_sek_litre: 15, yearly_km: 18000, daily_commute_km: 30 });
  const [saving, setSaving] = useState(false);
  const t = useRef(null);

  const loadPrices = useCallback(async () => {
    const { data } = await api.get("/settings/prices");
    setPrices({
      el_price_ore_kwh: Number(data.el_price_ore_kwh) || 250,
      bensin_price_sek_litre: Number(data.bensin_price_sek_litre) || 14,
      diesel_price_sek_litre: Number(data.diesel_price_sek_litre) || 15,
      yearly_km: Number(data.yearly_km) || 18000,
      daily_commute_km: Number(data.daily_commute_km) || 30,
    });
  }, []);

  const commit = useCallback(async (payload) => {
    setSaving(true);
    try { await api.post("/settings/prices", payload); }
    finally { setSaving(false); }
  }, []);

  const updatePrice = useCallback((patch) => {
    const next = { ...prices, ...patch };
    setPrices(next);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => commit(next), debounceMs);
  }, [prices, commit, debounceMs]);

  return { prices, updatePrice, savingPrices: saving, loadPrices };
}
