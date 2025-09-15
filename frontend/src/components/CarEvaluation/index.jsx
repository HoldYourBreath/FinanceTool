import { useMemo, useState, useEffect } from "react";
import EnergyFuelPanel from "./EnergyFuelPanel";
import Filters from "./Filters";
import CarsTable from "./CarsTable";
import usePrices from "../../hooks/usePrices";
import useCars from "../../hooks/useCars";
import { recalcAll } from "../../utils/carCalc";
import { normType } from "../../utils/normalizers"; // exact type canon: "ev" | "phev" | "diesel" | "bensin" | ...

export default function CarEvaluationPage() {
  const { prices, updatePrice, savingPrices, loadPrices } = usePrices();
  const { cars, setCars, filters, setFilters, loadCars, catChoices } =
    useCars();
  const [sortBy, setSortBy] = useState("tco_per_month_8y");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    loadPrices();
    loadCars();
  }, [loadPrices, loadCars]);
  useEffect(() => {
    setCars((prev) => recalcAll(prev, prices));
  }, [prices, setCars]);

  // 1) Filter first (exact matches via normType, not substring)
  const filteredCars = useMemo(() => {
    const q = (filters.q || "").trim().toLowerCase();
    const typeSet = new Set((filters.type_of_vehicle || []).map(normType));
    const bodySet = new Set(filters.body_style || []);
    const segSet  = new Set(filters.eu_segment || []);
    const suvSet  = new Set(filters.suv_tier || []);
    const yMin = filters.year_min ? Number(filters.year_min) : null;
    const yMax = filters.year_max ? Number(filters.year_max) : null;

    return cars.filter((c) => {
      if (q && !(c.model || "").toLowerCase().includes(q)) return false;
      if (yMin !== null && (c.year ?? 0) < yMin) return false;
      if (yMax !== null && (c.year ?? 9999) > yMax) return false;
      if (typeSet.size && !typeSet.has(normType(c.type_of_vehicle))) return false;
      if (bodySet.size && !bodySet.has(c.body_style)) return false;
      if (segSet.size  && !segSet.has(c.eu_segment)) return false;
      if (suvSet.size  && !suvSet.has(c.suv_tier)) return false;
      return true;
    });
  }, [cars, filters]);

  const sortedCars = useMemo(() => {
    // 2) Then sort the filtered list
    const getVal = (car, key) => {
      const v = car[key];
      return Number.isFinite(v)
        ? v
        : typeof v === "string"
          ? v.toLowerCase()
          : 0;
    };
    const list = [...filteredCars];
    return list.sort((a, b) => {
      const va = getVal(a, sortBy),
        vb = getVal(b, sortBy);
      if (typeof va === "number" && typeof vb === "number")
        return sortDir === "asc" ? va - vb : vb - va;
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredCars, sortBy, sortDir]);

  return (
    <div className="p-4 space-y-4">
      <EnergyFuelPanel
        prices={prices}
        updatePrice={updatePrice}
        saving={savingPrices}
      />

      <Filters
        filters={filters}
        setFilters={setFilters}
        catChoices={catChoices}
      />

      <CarsTable
        cars={sortedCars}
        setCars={setCars}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={(key) =>
          setSortBy((s) => (key !== s ? key : s)) ||
          setSortDir((d) =>
            key !== sortBy ? "asc" : d === "asc" ? "desc" : "asc",
          )
        }
        prices={prices}
      />
    </div>
  );
}
