// src/components/CarEvaluation.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/axios";
import { toFixed1, toNum, fmt0 } from "../utils/format";
import { fieldColor, monthlyConsumptionCost, NA } from "../utils/carCost";
import MultiToggle from "./MultiToggle";

// --- helpers -------------------------------------------------------------
const pickOfficialOrEst = (official, est) => {
  const o = Number(official) || 0;
  const e = Number(est) || 0;
  return { value: o > 0 ? o : e, isEst: !(o > 0) && e > 0 };
};

function normType(t) {
  const s = (t || "").toString().trim().toLowerCase();
  if (s === "bev" || s === "electric" || s === "ev") return "ev";
  if (s === "phev" || s.includes("plug")) return "phev";
  if (s.startsWith("d")) return "diesel";
  if (s.startsWith("b") || s.includes("petrol") || s.includes("gasoline")) return "bensin";
  return s || "ev";
}

const BODY_CHOICES_FALLBACK = ["SUV","Crossover","Sedan","Wagon","Hatchback","Coupe","Convertible","MPV","Pickup","Van"];
const SEG_CHOICES_FALLBACK  = ["A","B","C","D","E","F","J","M","S"];
const SUV_CHOICES_FALLBACK  = ["Subcompact","Compact","Midsize","Full-size"];
const TYPE_CHOICES          = ["EV", "PHEV", "Diesel", "Bensin"];

// Reusable header cell: every TH sticks to the top; extra lets us add left-stick for first col
const Header = ({ label, sortKey, align = "text-right", extra = "" , onSort, sortBy, sortDir }) => (
  <th
    className={`border px-2 py-1 ${align} cursor-pointer select-none sticky top-0 z-40 bg-gray-100 ${extra}`}
    onClick={() => onSort(sortKey)}
    title="Click to sort"
  >
    {label}
    <span className="ml-1 text-gray-500">
      {sortBy === sortKey ? (sortDir === "asc" ? "▲" : "▼") : ""}
    </span>
  </th>
);

export default function CarEvaluation() {
  const [cars, setCars] = useState([]);
  const [prices, setPrices] = useState({
    el_price_ore_kwh: 0,
    diesel_price_sek_litre: 0,
    bensin_price_sek_litre: 0,
    yearly_km: 18000,
    daily_commute_km: 30,
  });
  const [catChoices, setCatChoices] = useState({
    body: BODY_CHOICES_FALLBACK,
    seg: SEG_CHOICES_FALLBACK,
    suv: SUV_CHOICES_FALLBACK,
  });

  const [filters, setFilters] = useState({
    body_style: [],
    eu_segment: [],
    suv_tier: [],
    type_of_vehicle: [],
    q: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // sorting
  const [sortBy, setSortBy]   = useState("tco_per_month_8y");
  const [sortDir, setSortDir] = useState("asc");

  const sortToggle = (key) => {
    setSortBy((prev) => {
      if (prev !== key) {
        setSortDir("asc");
        return key;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return key;
    });
  };

  const depreciationRates = { 3: 0.15, 5: 0.25, 8: 0.4 };

  // yearly energy/fuel cost
  const energyFuelCostYear = useCallback(
    (car) => {
      const kmPerMonth = (Number(prices?.yearly_km) || 0) / 12;
      return (
        monthlyConsumptionCost(car, kmPerMonth, {
          el_price_ore_kwh: prices?.el_price_ore_kwh,
          diesel_price_sek_litre: prices?.diesel_price_sek_litre,
          bensin_price_sek_litre: prices?.bensin_price_sek_litre,
          daily_commute_km: prices?.daily_commute_km,
        }) * 12
      );
    },
    [prices]
  );

  const calcTCO = useCallback(
    (car, years) => {
      const base = toNum(car.estimated_purchase_price);
      const depreciation = base * (depreciationRates[years] || 0);
      const months = years * 12;

      const energyFuelPerMonth = energyFuelCostYear(car) / 12;
      const tiresTotal   = toNum(car.summer_tires_price) + toNum(car.winter_tires_price);
      const tiresPerMonth = months ? tiresTotal / months : 0;

      const insurancePerMonth = toNum(car.full_insurance_year) / 12;
      const repairsPerMonth   = toNum(car.repairs_year) / 12;
      const taxPerMonth       = toNum(car.car_tax_year) / 12;

      const runningPerMonth = energyFuelPerMonth + tiresPerMonth + insurancePerMonth + repairsPerMonth + taxPerMonth;
      const runningTotal    = runningPerMonth * months;

      return {
        total: runningTotal + depreciation,
        perMonth: months ? (runningTotal + depreciation) / months : 0,
        expectedValue: Math.max(0, base * (1 - (depreciationRates[years] || 0))),
      };
    },
    [energyFuelCostYear]
  );

  const recalcRow = useCallback(
    (c) => {
      const t3 = calcTCO(c, 3);
      const t5 = calcTCO(c, 5);
      const t8 = calcTCO(c, 8);
      return {
        ...c,
        energy_fuel_year: energyFuelCostYear(c),
        expected_value_after_3y: t3.expectedValue,
        expected_value_after_5y: t5.expectedValue,
        expected_value_after_8y: t8.expectedValue,
        tco_total_3y: t3.total,
        tco_total_5y: t5.total,
        tco_total_8y: t8.total,
        tco_per_month_3y: t3.perMonth,
        tco_per_month_5y: t5.perMonth,
        tco_per_month_8y: t8.perMonth,
      };
    },
    [calcTCO, energyFuelCostYear]
  );

  const recalcAll = useCallback((list) => list.map(recalcRow), [recalcRow]);

  // --- data fetching ------------------------------------------------------
  const didFetch = useRef(false);

  const buildQuery = () => {
    const p = new URLSearchParams();
    if (filters.body_style.length)     p.set("body_style", filters.body_style.join(","));
    if (filters.eu_segment.length)     p.set("eu_segment", filters.eu_segment.join(","));
    if (filters.suv_tier.length)       p.set("suv_tier", filters.suv_tier.join(","));
    if (filters.type_of_vehicle.length) p.set("type_of_vehicle", filters.type_of_vehicle.join(","));
    if (filters.q) p.set("q", filters.q);
    return p.toString();
  };

  const loadCars = useCallback(async () => {
    try {
      const qs  = buildQuery();
      const url = qs ? `/cars?${qs}` : "/cars";
      const res = await api.get(url);
      const normalized = (res.data || []).map((c) => ({
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
      }));
      setCars(recalcAll(normalized));
    } catch (e) {
      console.error("Failed to fetch car data:", e);
      setError("Failed to load cars.");
    }
  }, [filters, recalcAll]);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    (async () => {
      try {
        const pricesRes = await api.get("/settings/prices");
        const p = pricesRes.data || {};
        setPrices({
          el_price_ore_kwh: Number(p.el_price_ore_kwh) || 0,
          diesel_price_sek_litre: Number(p.diesel_price_sek_litre) || 0,
          bensin_price_sek_litre: Number(p.bensin_price_sek_litre) || 0,
          yearly_km: Number(p.yearly_km) || 18000,
          daily_commute_km: Number(p.daily_commute_km) || 30,
        });

        try {
          const cats = await api.get("/cars/categories");
          const data = cats.data || {};
          setCatChoices({
            body: Array.isArray(data.body_styles) && data.body_styles.length ? data.body_styles : BODY_CHOICES_FALLBACK,
            seg:  Array.isArray(data.eu_segments) && data.eu_segments.length ? data.eu_segments : SEG_CHOICES_FALLBACK,
            suv:  Array.isArray(data.suv_tiers) && data.suv_tiers.length ? data.suv_tiers : SUV_CHOICES_FALLBACK,
          });
        } catch (e) {
          console.warn("/cars/categories not available, using fallbacks", e);
          setCatChoices({ body: BODY_CHOICES_FALLBACK, seg: SEG_CHOICES_FALLBACK, suv: SUV_CHOICES_FALLBACK });
        }

        await loadCars();
      } catch (e) {
        console.error("Initial load failed:", e);
        setError("Failed initial load.");
      }
    })();
  }, [loadCars]);

  // re-calc on price changes
  useEffect(() => { setCars((prev) => recalcAll(prev)); }, [prices, recalcAll]);

  // re-fetch on filters change
  useEffect(() => { if (didFetch.current) loadCars(); }, [filters, loadCars]);

  const onChange = (idx, field, value) => {
    setCars((prev) => {
      const next = [...prev];
      let v = value;
      if (!["model", "type_of_vehicle", "dc_time_source", "ac_time_source"].includes(field)) v = toNum(value);
      next[idx] = recalcRow({ ...next[idx], [field]: v });
      return next;
    });
  };

  const saveAll = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = cars.map((c) => ({
        id: c.id,
        model: c.model,
        year: Number(c.year) || 0,

        body_style: c.body_style || null,
        eu_segment: c.eu_segment || null,
        suv_tier: c.suv_tier || null,

        estimated_purchase_price: Number(c.estimated_purchase_price) || 0,
        summer_tires_price: Number(c.summer_tires_price) || 0,
        winter_tires_price: Number(c.winter_tires_price) || 0,
        consumption_kwh_per_100km: Number(c.consumption_kwh_per_100km) || 0,
        consumption_l_per_100km: Number(c.consumption_l_per_100km) || 0,
        battery_capacity_kwh: Number(c.battery_capacity_kwh) || 0,
        range: Number(c.range) || 0,
        trunk_size_litre: Number(c.trunk_size_litre) || 0,
        acceleration_0_100: Number(c.acceleration_0_100) || 0,

        dc_peak_kw: Number(c.dc_peak_kw) || 0,
        dc_time_min_10_80: Number(c.dc_time_min_10_80) || 0,
        dc_time_source: c.dc_time_source || "",
        ac_onboard_kw: Number(c.ac_onboard_kw) || 0,
        ac_time_h_0_100: Number(c.ac_time_h_0_100) || 0,
        ac_time_source: c.ac_time_source || "",

        full_insurance_year: Number(c.full_insurance_year) || 0,
        half_insurance_year: Number(c.half_insurance_year) || 0,
        car_tax_year: Number(c.car_tax_year) || 0,
        repairs_year: Number(c.repairs_year) || 0,

        type_of_vehicle: c.type_of_vehicle,
      }));

      const res = await api.post("/cars/update", payload, {
        headers: { "Content-Type": "application/json" },
        validateStatus: () => true,
      });

      if (res.status >= 200 && res.status < 300) {
        const count = res.data?.updated ?? payload.length;
        setNotice(`✅ Saved ${count} car${count === 1 ? "" : "s"}.`);
        setTimeout(() => setNotice(""), 2200);
      } else {
        console.error("Save failed:", res.status, res.data);
        setError(`Save failed (${res.status}). Check server logs.`);
      }
    } catch (e) {
      console.error("Save failed (network):", e);
      setError("Failed to reach /api/cars/update.");
    } finally {
      setSaving(false);
    }
  };

  const getVal = (car, key) => {
    const v = car[key];
    return Number.isFinite(v) ? v : typeof v === "string" ? v.toLowerCase() : 0;
  };

  const sortedCars = [...cars].sort((a, b) => {
    const va = getVal(a, sortBy);
    const vb = getVal(b, sortBy);
    if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // --- UI -----------------------------------------------------------------
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold">Car Evaluation</h2>
      {error && <div className="text-red-600">{error}</div>}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-3 bg-gray-50 rounded border">
        <div className="col-span-1">
          <MultiToggle label="Body style" options={catChoices.body} value={filters.body_style} onChange={(v) => setFilters((f) => ({ ...f, body_style: v }))} />
        </div>
        <div className="col-span-1">
          <MultiToggle label="EU segment" options={catChoices.seg} value={filters.eu_segment} onChange={(v) => setFilters((f) => ({ ...f, eu_segment: v }))} />
        </div>
        <div className="col-span-1">
          <MultiToggle label="SUV tier" options={catChoices.suv} value={filters.suv_tier} onChange={(v) => setFilters((f) => ({ ...f, suv_tier: v }))} />
        </div>
        <div className="col-span-1">
          <MultiToggle label="Type" options={TYPE_CHOICES} value={filters.type_of_vehicle} onChange={(v) => setFilters((f) => ({ ...f, type_of_vehicle: v }))} />
        </div>
        <div className="col-span-1 md:col-span-2 lg:col-span-4 flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="filter-q" className="block text-sm font-semibold mb-1">Search model</label>
            <input
              id="filter-q"
              className="w-full border rounded px-2 py-1"
              placeholder="e.g., Model Y, Ioniq 5"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <button
            className="border px-3 py-2 rounded"
            onClick={() => setFilters({ body_style: [], eu_segment: [], suv_tier: [], type_of_vehicle: [], q: "" })}
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* ONE scroll container only */}
      <div className="relative max-h-[72vh] overflow-auto border rounded">
        {/* separate borders + zero spacing keeps sticky reliable */}
        <table className="min-w-max table-fixed border-separate border-spacing-0">
          {/* Keep first column the same width everywhere */}
          <colgroup>
            <col className="w-[18rem]" />
          </colgroup>

          <thead>
            <tr>
              <Header
                label="Car Model"
                sortKey="model"
                align="text-left"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={sortToggle}
                extra="left-0 z-50 w-[18rem] shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.06)]"
              />
              <Header label="Year" sortKey="year" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Type" sortKey="type_of_vehicle" align="text-left" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Estimated Purchase Price" sortKey="estimated_purchase_price" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Summer Tires Price" sortKey="summer_tires_price" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Winter Tires Price" sortKey="winter_tires_price" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Consumption (kWh/100km)" sortKey="consumption_kwh_per_100km" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Consumption (l/100km)" sortKey="consumption_l_per_100km" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Battery (kWh)" sortKey="battery_capacity_kwh" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="DC Peak (kW)" sortKey="dc_peak_kw" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="DC 10→80 (min)" sortKey="dc_time_min_10_80" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="AC Onboard (kW)" sortKey="ac_onboard_kw" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="AC 0→100 (h)" sortKey="ac_time_h_0_100" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Energy & Fuel Price (SEK) / year" sortKey="energy_fuel_year" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="WLTP (EV) Range (km)" sortKey="range" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Acceleration (0–100 km/h)" sortKey="acceleration_0_100" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Trunk Size (l)" sortKey="trunk_size_litre" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Full Insurance / Year" sortKey="full_insurance_year" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Half Insurance / Year" sortKey="half_insurance_year" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Car Tax / Year" sortKey="car_tax_year" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Repairs / Year" sortKey="repairs_year" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Expected Value (3y)" sortKey="expected_value_after_3y" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Expected Value (5y)" sortKey="expected_value_after_5y" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="Expected Value (8y)" sortKey="expected_value_after_8y" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="TCO Total (3y)" sortKey="tco_total_3y" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="TCO Total (5y)" sortKey="tco_total_5y" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="TCO Total (8y)" sortKey="tco_total_8y" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="TCO / mo (3y)" sortKey="tco_per_month_3y" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="TCO / mo (5y)" sortKey="tco_per_month_5y" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
              <Header label="TCO / mo (8y)" sortKey="tco_per_month_8y" sortBy={sortBy} sortDir={sortDir} onSort={sortToggle} />
            </tr>
          </thead>

          <tbody>
            {sortedCars.map((car, idx) => {
              const type       = normType(car.type_of_vehicle);
              const showKwh    = type === "ev" || type === "phev";
              const showLitres = type !== "ev";
              const isEVlike   = type.includes("ev"); // ev or phev

              return (
                <tr key={car.id}>
                  {/* Frozen first column cell — same width; body z below header */}
                  <td className="border px-2 py-1 sticky left-0 z-30 bg-white w-[18rem]
                                 shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.06)]">
                    <input
                      className="w-full border px-1"
                      value={car.model}
                      onChange={(e) => onChange(idx, "model", e.target.value)}
                    />
                  </td>

                  {/* Year */}
                  <td className="border px-2 py-1 text-right">
                    <input type="number" className="w-24 border px-1 text-right" value={car.year} onChange={(e) => onChange(idx, "year", e.target.value)} />
                  </td>

                  {/* Type */}
                  <td className="border px-2 py-1">
                    <select className="border px-1 w-28" value={car.type_of_vehicle || "EV"} onChange={(e) => onChange(idx, "type_of_vehicle", e.target.value)}>
                      {TYPE_CHOICES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>

                  {/* Price & tires */}
                  <td className="border px-2 py-1 text-right">
                    <input type="number" className="w-28 border px-1 text-right" value={car.estimated_purchase_price}
                           onChange={(e) => onChange(idx, "estimated_purchase_price", e.target.value)} />
                  </td>
                  <td className="border px-2 py-1 text-right">
                    <input type="number" className="w-24 border px-1 text-right" value={car.summer_tires_price}
                           onChange={(e) => onChange(idx, "summer_tires_price", e.target.value)} />
                  </td>
                  <td className="border px-2 py-1 text-right">
                    <input type="number" className="w-24 border px-1 text-right" value={car.winter_tires_price}
                           onChange={(e) => onChange(idx, "winter_tires_price", e.target.value)} />
                  </td>

                  {/* kWh/100km */}
                  <td className="border px-2 py-1 text-right">
                    {showKwh ? (
                      <input type="number" step="0.1" className="w-24 border px-1 text-right"
                             value={car.consumption_kwh_per_100km ?? 0}
                             onChange={(e) => onChange(idx, "consumption_kwh_per_100km", e.target.value)}
                             title="Electric consumption (kWh/100km)" />
                    ) : <NA hint="Not used for Diesel/Bensin" />}
                  </td>

                  {/* L/100km */}
                  <td className="border px-2 py-1 text-right">
                    {showLitres ? (
                      <input type="number" step="0.1" className="w-24 border px-1 text-right"
                             value={car.consumption_l_per_100km ?? 0}
                             onChange={(e) => onChange(idx, "consumption_l_per_100km", e.target.value)}
                             title="Fuel consumption (L/100km)" />
                    ) : <NA hint="Not used for EV" />}
                  </td>

                  {/* Battery */}
                  <td className="border px-2 py-1 text-right">
                    <input type="number" step="0.1" min="0" className="w-24 border px-1 text-right"
                           value={toFixed1(car.battery_capacity_kwh)}
                           onChange={(e) => onChange(idx, "battery_capacity_kwh", e.target.value)} />
                  </td>

                  {/* DC peak */}
                  <td className="border px-2 py-1 text-right">
                    {isEVlike ? (
                      <input type="number" step="0.1" className="w-24 border px-1 text-right"
                             value={car.dc_peak_kw ?? 0}
                             onChange={(e) => onChange(idx, "dc_peak_kw", e.target.value)}
                             title="Peak DC fast-charge power (kW)" />
                    ) : <NA hint="Not applicable for ICE" />}
                  </td>

                  {/* DC 10→80 (min) + est */}
                  <td className="border px-2 py-1 text-right">
                    {isEVlike ? (
                      <div className="flex items-center gap-2 justify-end">
                        {(() => {
                          const p = pickOfficialOrEst(car.dc_time_min_10_80, car.dc_time_min_10_80_est);
                          return (
                            <>
                              <input type="number" step="0.1" className="w-24 border px-1 text-right"
                                     value={p.value}
                                     onChange={(e) => onChange(idx, "dc_time_min_10_80", e.target.value)}
                                     title="DC 10→80% (minutes)" />
                              {p.isEst && <span className="text-xs text-gray-500 italic">(est)</span>}
                            </>
                          );
                        })()}
                      </div>
                    ) : <NA hint="Not applicable for ICE" />}
                  </td>

                  {/* AC onboard */}
                  <td className="border px-2 py-1 text-right">
                    {isEVlike ? (
                      <input type="number" step="0.1" className="w-24 border px-1 text-right"
                             value={car.ac_onboard_kw ?? 0}
                             onChange={(e) => onChange(idx, "ac_onboard_kw", e.target.value)}
                             title="Onboard AC charger (kW)" />
                    ) : <NA hint="Not applicable for ICE" />}
                  </td>

                  {/* AC 0→100 (h) + est */}
                  <td className="border px-2 py-1 text-right">
                    {isEVlike ? (
                      <div className="flex items-center gap-2 justify-end">
                        {(() => {
                          const p = pickOfficialOrEst(car.ac_time_h_0_100, car.ac_time_h_0_100_est);
                          return (
                            <>
                              <input type="number" step="0.1" className="w-24 border px-1 text-right"
                                     value={p.value}
                                     onChange={(e) => onChange(idx, "ac_time_h_0_100", e.target.value)}
                                     title="AC 0→100% (hours)" />
                              {p.isEst && <span className="text-xs text-gray-500 italic">(est)</span>}
                            </>
                          );
                        })()}
                      </div>
                    ) : <NA hint="Not applicable for ICE" />}
                  </td>

                  {/* Energy & fuel / year */}
                  <td className="border px-2 py-1 text-right">{fmt0(energyFuelCostYear(car))}</td>

                  {/* Range */}
                  <td className="border px-2 py-1 text-right">
                    <input type="number" className={`w-24 border px-1 text-right ${fieldColor("range", car.range)}`}
                           value={car.range} onChange={(e) => onChange(idx, "range", e.target.value)} />
                  </td>

                  {/* Accel */}
                  <td className="border px-2 py-1 text-right">
                    <input type="number" className={`w-24 border px-1 text-right ${fieldColor("acceleration_0_100", car.acceleration_0_100)}`}
                           value={car.acceleration_0_100} onChange={(e) => onChange(idx, "acceleration_0_100", e.target.value)} />
                  </td>

                  {/* Trunk */}
                  <td className="border px-2 py-1 text-right">
                    <input type="number" className={`w-24 border px-1 text-right ${fieldColor("trunk_size_litre", car.trunk_size_litre)}`}
                           value={car.trunk_size_litre} onChange={(e) => onChange(idx, "trunk_size_litre", e.target.value)} />
                  </td>

                  {/* Costs */}
                  <td className="border px-2 py-1 text-right">
                    <input type="number" className={`w-24 border px-1 text-right ${fieldColor("full_insurance_year", car.full_insurance_year)}`}
                           value={car.full_insurance_year} onChange={(e) => onChange(idx, "full_insurance_year", e.target.value)} />
                  </td>
                  <td className="border px-2 py-1 text-right">
                    <input type="number" className={`w-24 border px-1 text-right ${fieldColor("half_insurance_year", car.half_insurance_year)}`}
                           value={car.half_insurance_year} onChange={(e) => onChange(idx, "half_insurance_year", e.target.value)} />
                  </td>
                  <td className="border px-2 py-1 text-right">
                    <input type="number" className={`w-24 border px-1 text-right ${fieldColor("car_tax_year", car.car_tax_year)}`}
                           value={car.car_tax_year} onChange={(e) => onChange(idx, "car_tax_year", e.target.value)} />
                  </td>
                  <td className="border px-2 py-1 text-right">
                    <input type="number" className="w-24 border px-1 text-right"
                           value={car.repairs_year} onChange={(e) => onChange(idx, "repairs_year", e.target.value)}
                           min="0" step="1" />
                  </td>

                  {/* Derived / TCO */}
                  <td className="border px-2 py-1 text-right">{fmt0(car.expected_value_after_3y)}</td>
                  <td className="border px-2 py-1 text-right">{fmt0(car.expected_value_after_5y)}</td>
                  <td className="border px-2 py-1 text-right">{fmt0(car.expected_value_after_8y)}</td>
                  <td className="border px-2 py-1 text-right">{fmt0(car.tco_total_3y)}</td>
                  <td className="border px-2 py-1 text-right">{fmt0(car.tco_total_5y)}</td>
                  <td className="border px-2 py-1 text-right">{fmt0(car.tco_total_8y)}</td>
                  <td className="border px-2 py-1 text-right">{fmt0(car.tco_per_month_3y)}</td>
                  <td className="border px-2 py-1 text-right">{fmt0(car.tco_per_month_5y)}</td>
                  <td className="border px-2 py-1 text-right">{fmt0(car.tco_per_month_8y)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button disabled={saving} onClick={saveAll} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60">
        {saving ? "Saving…" : "Save Changes"}
      </button>

      {notice && <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow">{notice}</div>}
    </div>
  );
}
