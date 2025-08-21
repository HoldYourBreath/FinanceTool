import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { toNum } from "../utils/format";

const BODY_CHOICES_FALLBACK = ["SUV","Crossover","Sedan","Wagon","Hatchback","Coupe","Convertible","MPV","Pickup","Van"];
const SEG_CHOICES_FALLBACK  = ["A","B","C","D","E","F","J","M","S"];
const SUV_CHOICES_FALLBACK  = ["Subcompact","Compact","Midsize","Full-size"];

export default function useCars() {
  const [cars, setCars] = useState([]);
  const [filters, setFilters] = useState({
    body_style: [],
    eu_segment: [],
    suv_tier: [],
    type_of_vehicle: [],
    q: "",
  });
  const [catChoices, setCatChoices] = useState({
    body: BODY_CHOICES_FALLBACK,
    seg: SEG_CHOICES_FALLBACK,
    suv: SUV_CHOICES_FALLBACK,
  });
  const didInit = useRef(false);

  const normalize = useCallback((c) => ({
    ...c,
    type_of_vehicle: (c.type_of_vehicle || "").trim(),
    body_style: c.body_style || "",
    eu_segment: c.eu_segment || "",
    suv_tier: c.suv_tier || "",
    year: toNum(c.year),
    estimated_purchase_price: toNum(c.estimated_purchase_price),
    summer_tires_price: toNum(c.summer_tires_price),
    winter_tires_price: toNum(c.winter_tires_price),

    // consumption
    consumption_kwh_per_100km: toNum(c.consumption_kwh_per_100km),
    consumption_l_per_100km: toNum(c.consumption_l_per_100km ?? c.consumption_l_100km),

    // battery/specs
    battery_capacity_kwh: toNum(c.battery_capacity_kwh),
    range: toNum(c.range),
    trunk_size_litre: toNum(c.trunk_size_litre),
    acceleration_0_100: toNum(c.acceleration_0_100),

    // charging
    dc_peak_kw: toNum(c.dc_peak_kw),
    dc_time_min_10_80: toNum(c.dc_time_min_10_80),
    dc_time_min_10_80_est: toNum(c.dc_time_min_10_80_est),
    dc_time_source: c.dc_time_source || "",
    ac_onboard_kw: toNum(c.ac_onboard_kw),
    ac_time_h_0_100: toNum(c.ac_time_h_0_100),
    ac_time_h_0_100_est: toNum(c.ac_time_h_0_100_est),
    ac_time_source: c.ac_time_source || "",

    // costs
    full_insurance_year: toNum(c.full_insurance_year),
    half_insurance_year: toNum(c.half_insurance_year),
    car_tax_year: toNum(c.car_tax_year),
    repairs_year: toNum(c.repairs_year),

    // legacy TCO
    tco_3_years: toNum(c.tco_3_years),
    tco_5_years: toNum(c.tco_5_years),
    tco_8_years: toNum(c.tco_8_years),
  }), []);

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (filters.body_style.length)      p.set("body_style", filters.body_style.join(","));
    if (filters.eu_segment.length)      p.set("eu_segment", filters.eu_segment.join(","));
    if (filters.suv_tier.length)        p.set("suv_tier", filters.suv_tier.join(","));
    if (filters.type_of_vehicle.length) p.set("type_of_vehicle", filters.type_of_vehicle.join(","));
    if (filters.q)                       p.set("q", filters.q);
    return p.toString();
  }, [filters]);

  const loadCars = useCallback(async () => {
    const qs = buildQuery();
    const url = qs ? `/cars?${qs}` : "/cars";
    const res = await api.get(url);
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map(normalize);
  }, [buildQuery, normalize]);

  // init categories + first load
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      try {
        const cats = await api.get("/cars/categories");
        const data = cats.data || {};
        setCatChoices({
          body: Array.isArray(data.body_styles) && data.body_styles.length ? data.body_styles : BODY_CHOICES_FALLBACK,
          seg:  Array.isArray(data.eu_segments) && data.eu_segments.length ? data.eu_segments : SEG_CHOICES_FALLBACK,
          suv:  Array.isArray(data.suv_tiers) && data.suv_tiers.length ? data.suv_tiers : SUV_CHOICES_FALLBACK,
        });
      } catch {
        setCatChoices({ body: BODY_CHOICES_FALLBACK, seg: SEG_CHOICES_FALLBACK, suv: SUV_CHOICES_FALLBACK });
      }
      const first = await loadCars();
      setCars(first);
    })();
  }, [loadCars]);

  // reload when filters change
  useEffect(() => {
    if (!didInit.current) return;
    (async () => setCars(await loadCars()))();
  }, [filters, loadCars]);

  return { cars, setCars, filters, setFilters, catChoices, loadCars };
}
