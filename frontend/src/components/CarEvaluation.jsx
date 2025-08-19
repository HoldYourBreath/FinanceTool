// src/components/CarEvaluation.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/axios";
import { toFixed1, toNum, fmt0 } from "../utils/format";
import { fieldColor, monthlyConsumptionCost, NA } from "../utils/carCost";

function normType(t) {
  const s = (t || "").toString().trim().toLowerCase();
  if (s === "bev" || s === "electric" || s === "ev") return "ev";
  if (s === "phev" || s.includes("plug")) return "phev";
  if (s.startsWith("d")) return "diesel"; // diesel, d
  if (s.startsWith("b") || s.includes("petrol") || s.includes("gasoline"))
    return "bensin"; // bensin, petrol, gasoline, b
  return s || "ev";
}

export default function CarEvaluation() {
  const [cars, setCars] = useState([]);
  const [prices, setPrices] = useState({
    el_price_ore_kwh: 0,
    diesel_price_sek_litre: 0,
    bensin_price_sek_litre: 0,
    yearly_km: 18000,
    daily_commute_km: 30,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // sorting
  const [sortBy, setSortBy] = useState("tco_per_month_8y");
  const [sortDir, setSortDir] = useState("asc");

  const depreciationRates = { 3: 0.15, 5: 0.25, 8: 0.4 };

  const energyFuelCostYear = useCallback(
    (car) => {
      const kmPerMonth = (Number(prices?.yearly_km) || 0) / 12;
      return (
        monthlyConsumptionCost(car, kmPerMonth, {
          el_price_ore_kwh: prices?.el_price_ore_kwh,
          diesel_price_sek_litre: prices?.diesel_price_sek_litre,
          bensin_price_sek_litre: prices?.bensin_price_sek_litre,
          yearly_km: prices?.yearly_km,
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
      const tiresTotal =
        toNum(car.summer_tires_price) + toNum(car.winter_tires_price);
      const tiresPerMonth = months ? tiresTotal / months : 0;

      const insurancePerMonth = toNum(car.full_insurance_year) / 12;
      const repairsPerMonth = toNum(car.repairs_year) / 12;
      const taxPerMonth = toNum(car.car_tax_year) / 12;

      const runningPerMonth =
        energyFuelPerMonth +
        tiresPerMonth +
        insurancePerMonth +
        repairsPerMonth +
        taxPerMonth;
      const runningTotal = runningPerMonth * months;

      return {
        total: runningTotal + depreciation,
        perMonth: months ? (runningTotal + depreciation) / months : 0,
        expectedValue: Math.max(
          0,
          base * (1 - (depreciationRates[years] || 0))
        ),
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

  // initial fetch (guard StrictMode double-run)
  const didFetch = useRef(false);
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

        const res = await api.get("/cars");
        const normalized = (res.data || []).map((c) => ({
          ...c,
          type_of_vehicle: (c.type_of_vehicle || "").trim(),
          year: toNum(c.year),
          estimated_purchase_price: toNum(c.estimated_purchase_price),
          summer_tires_price: toNum(c.summer_tires_price),
          winter_tires_price: toNum(c.winter_tires_price),

          // Both consumption fields (may be 0 depending on type)
          consumption_kwh_per_100km: toNum(c.consumption_kwh_per_100km),
          consumption_l_per_100km: toNum(
            c.consumption_l_per_100km ?? c.consumption_l_100km
          ),

          battery_capacity_kwh: toNum(c.battery_capacity_kwh),
          range: toNum(c.range),
          trunk_size_litre: toNum(c.trunk_size_litre),
          acceleration_0_100: toNum(c.acceleration_0_100),

          full_insurance_year: toNum(c.full_insurance_year),
          half_insurance_year: toNum(c.half_insurance_year),
          car_tax_year: toNum(c.car_tax_year),
          repairs_year: toNum(c.repairs_year),

          tco_3_years: toNum(c.tco_3_years),
          tco_5_years: toNum(c.tco_5_years),
          tco_8_years: toNum(c.tco_8_years),
        }));
        setCars(normalized);
      } catch (e) {
        console.error("Failed to fetch car data:", e);
        setError("Failed to load cars.");
      }
    })();
  }, []);

  // whenever prices change, recompute derived fields for all cars
  useEffect(() => {
    setCars((prev) => recalcAll(prev));
  }, [prices, recalcAll]);

  const onChange = (idx, field, value) => {
    setCars((prev) => {
      const next = [...prev];
      const v = field === "model" ? value : toNum(value);
      next[idx] = recalcRow({ ...next[idx], [field]: v });
      return next;
    });
  };

  const saveAll = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = cars.map((c) => ({
        id: c.id,
        model: c.model,
        year: Number(c.year) || 0,
        estimated_purchase_price: Number(c.estimated_purchase_price) || 0,
        summer_tires_price: Number(c.summer_tires_price) || 0,
        winter_tires_price: Number(c.winter_tires_price) || 0,
        consumption_kwh_per_100km:
          Number(c.consumption_kwh_per_100km) || 0,
        consumption_l_per_100km:
          Number(c.consumption_l_per_100km) || 0,
        battery_capacity_kwh: Number(c.battery_capacity_kwh) || 0,
        range: Number(c.range) || 0,
        trunk_size_litre: Number(c.trunk_size_litre) || 0,
        acceleration_0_100: Number(c.acceleration_0_100) || 0,
        full_insurance_year: Number(c.full_insurance_year) || 0,
        half_insurance_year: Number(c.half_insurance_year) || 0,
        car_tax_year: Number(c.car_tax_year) || 0,
        repairs_year: Number(c.repairs_year) || 0,
        // (include type_of_vehicle if your API allows updating it)
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

  const getVal = (car, key) => {
    const v = car[key];
    return Number.isFinite(v) ? v : typeof v === "string" ? v.toLowerCase() : 0;
    // (fallback numbers for undefined)
  };

  const sortedCars = [...cars].sort((a, b) => {
    const va = getVal(a, sortBy);
    const vb = getVal(b, sortBy);
    if (typeof va === "number" && typeof vb === "number") {
      return sortDir === "asc" ? va - vb : vb - va;
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const Header = ({ label, sortKey, align = "text-right" }) => (
    <th
      className={`border px-2 py-1 ${align} cursor-pointer select-none`}
      onClick={() => sortToggle(sortKey)}
      title="Click to sort"
    >
      {label}
      <span className="ml-1 text-gray-500">
        {sortBy === sortKey ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </span>
    </th>
  );

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold">Car Evaluation</h2>
      {error && <div className="text-red-600">{error}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <Header label="Car Model" sortKey="model" align="text-left" />
              <Header label="Year" sortKey="year" />
              <Header
                label="Estimated Purchase Price"
                sortKey="estimated_purchase_price"
              />
              <Header label="Summer Tires Price" sortKey="summer_tires_price" />
              <Header label="Winter Tires Price" sortKey="winter_tires_price" />
              <Header
                label="Consumption (kWh/100km)"
                sortKey="consumption_kwh_per_100km"
              />
              <Header
                label="Consumption (l/100km)"
                sortKey="consumption_l_per_100km"
              />
              <Header label="Battery (kWh)" sortKey="battery_capacity_kwh" />
              <Header
                label="Energy & Fuel Price (SEK) / year"
                sortKey="energy_fuel_year"
              />
              <Header label="WLTP (EV) Range (km)" sortKey="range" />
              <Header
                label="Acceleration (0–100 km/h)"
                sortKey="acceleration_0_100"
              />
              <Header label="Trunk Size (l)" sortKey="trunk_size_litre" />
              <Header
                label="Full Insurance / Year"
                sortKey="full_insurance_year"
              />
              <Header
                label="Half Insurance / Year"
                sortKey="half_insurance_year"
              />
              <Header label="Car Tax / Year" sortKey="car_tax_year" />
              <Header label="Repairs / Year" sortKey="repairs_year" />
              <Header
                label="Expected Value (3y)"
                sortKey="expected_value_after_3y"
              />
              <Header
                label="Expected Value (5y)"
                sortKey="expected_value_after_5y"
              />
              <Header
                label="Expected Value (8y)"
                sortKey="expected_value_after_8y"
              />
              <Header label="TCO Total (3y)" sortKey="tco_total_3y" />
              <Header label="TCO Total (5y)" sortKey="tco_total_5y" />
              <Header label="TCO Total (8y)" sortKey="tco_total_8y" />
              <Header label="TCO / mo (3y)" sortKey="tco_per_month_3y" />
              <Header label="TCO / mo (5y)" sortKey="tco_per_month_5y" />
              <Header label="TCO / mo (8y)" sortKey="tco_per_month_8y" />
            </tr>
          </thead>
          <tbody>
            {sortedCars.map((car, idx) => {
              const type = normType(car.type_of_vehicle);
              const showKwh = type === "ev" || type === "phev";
              const showLitres = type !== "ev"; // diesel, bensin, phev
              return (
                <tr key={car.id}>
                  <td className="border px-2 py-1">
                    <input
                      className="w-64 border px-1"
                      value={car.model}
                      onChange={(e) => onChange(idx, "model", e.target.value)}
                    />
                  </td>
                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      className="w-24 border px-1 text-right"
                      value={car.year}
                      onChange={(e) => onChange(idx, "year", e.target.value)}
                    />
                  </td>
                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      className="w-28 border px-1 text-right"
                      value={car.estimated_purchase_price}
                      onChange={(e) =>
                        onChange(
                          idx,
                          "estimated_purchase_price",
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      className="w-24 border px-1 text-right"
                      value={car.summer_tires_price}
                      onChange={(e) =>
                        onChange(idx, "summer_tires_price", e.target.value)
                      }
                    />
                  </td>
                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      className="w-24 border px-1 text-right"
                      value={car.winter_tires_price}
                      onChange={(e) =>
                        onChange(idx, "winter_tires_price", e.target.value)
                      }
                    />
                  </td>

                  {/* kWh/100km */}
                  <td className="border px-2 py-1 text-right">
                    {showKwh ? (
                      <input
                        type="number"
                        step="0.1"
                        className="w-24 border px-1 text-right"
                        value={car.consumption_kwh_per_100km ?? 0}
                        onChange={(e) =>
                          onChange(
                            idx,
                            "consumption_kwh_per_100km",
                            e.target.value
                          )
                        }
                        title="Electric consumption (kWh/100km)"
                      />
                    ) : (
                      <NA hint="Not used for Diesel/Bensin" />
                    )}
                  </td>

                  {/* L/100km */}
                  <td className="border px-2 py-1 text-right">
                    {showLitres ? (
                      <input
                        type="number"
                        step="0.1"
                        className="w-24 border px-1 text-right"
                        value={car.consumption_l_per_100km ?? 0}
                        onChange={(e) =>
                          onChange(
                            idx,
                            "consumption_l_per_100km",
                            e.target.value
                          )
                        }
                        title="Fuel consumption (L/100km)"
                      />
                    ) : (
                      <NA hint="Not used for EV" />
                    )}
                  </td>

                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="w-24 border px-1 text-right"
                      value={toFixed1(car.battery_capacity_kwh)}
                      onChange={(e) =>
                        onChange(idx, "battery_capacity_kwh", e.target.value)
                      }
                    />
                  </td>

                  <td className="border px-2 py-1 text-right">
                    {fmt0(energyFuelCostYear(car))}
                  </td>

                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      className={`w-24 border px-1 text-right ${fieldColor(
                        "range",
                        car.range
                      )}`}
                      value={car.range}
                      onChange={(e) => onChange(idx, "range", e.target.value)}
                    />
                  </td>

                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      className={`w-24 border px-1 text-right ${fieldColor(
                        "acceleration_0_100",
                        car.acceleration_0_100
                      )}`}
                      value={car.acceleration_0_100}
                      onChange={(e) =>
                        onChange(idx, "acceleration_0_100", e.target.value)
                      }
                    />
                  </td>

                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      className={`w-24 border px-1 text-right ${fieldColor(
                        "trunk_size_litre",
                        car.trunk_size_litre
                      )}`}
                      value={car.trunk_size_litre}
                      onChange={(e) =>
                        onChange(idx, "trunk_size_litre", e.target.value)
                      }
                    />
                  </td>

                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      className={`w-24 border px-1 text-right ${fieldColor(
                        "full_insurance_year",
                        car.full_insurance_year
                      )}`}
                      value={car.full_insurance_year}
                      onChange={(e) =>
                        onChange(idx, "full_insurance_year", e.target.value)
                      }
                    />
                  </td>

                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      className={`w-24 border px-1 text-right ${fieldColor(
                        "half_insurance_year",
                        car.half_insurance_year
                      )}`}
                      value={car.half_insurance_year}
                      onChange={(e) =>
                        onChange(idx, "half_insurance_year", e.target.value)
                      }
                    />
                  </td>

                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      className={`w-24 border px-1 text-right ${fieldColor(
                        "car_tax_year",
                        car.car_tax_year
                      )}`}
                      value={car.car_tax_year}
                      onChange={(e) =>
                        onChange(idx, "car_tax_year", e.target.value)
                      }
                    />
                  </td>

                  <td className="border px-2 py-1 text-right">
                    <input
                      type="number"
                      className="w-24 border px-1 text-right"
                      value={car.repairs_year}
                      onChange={(e) =>
                        onChange(idx, "repairs_year", e.target.value)
                      }
                      min="0"
                      step="1"
                    />
                  </td>

                  <td className="border px-2 py-1 text-right">
                    {fmt0(car.expected_value_after_3y)}
                  </td>
                  <td className="border px-2 py-1 text-right">
                    {fmt0(car.expected_value_after_5y)}
                  </td>
                  <td className="border px-2 py-1 text-right">
                    {fmt0(car.expected_value_after_8y)}
                  </td>

                  <td className="border px-2 py-1 text-right">
                    {fmt0(car.tco_total_3y)}
                  </td>
                  <td className="border px-2 py-1 text-right">
                    {fmt0(car.tco_total_5y)}
                  </td>
                  <td className="border px-2 py-1 text-right">
                    {fmt0(car.tco_total_8y)}
                  </td>

                  <td className="border px-2 py-1 text-right">
                    {fmt0(car.tco_per_month_3y)}
                  </td>
                  <td className="border px-2 py-1 text-right">
                    {fmt0(car.tco_per_month_5y)}
                  </td>
                  <td className="border px-2 py-1 text-right">
                    {fmt0(car.tco_per_month_8y)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        disabled={saving}
        onClick={saveAll}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>

      {notice && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow">
          {notice}
        </div>
      )}
    </div>
  );
}
