import { useMemo, useState, useEffect } from "react";
import EnergyFuelPanel from "./EnergyFuelPanel";
import Filters from "./Filters";
import CarsTable from "./CarsTable";
import usePrices from "../../hooks/usePrices";
import useCars from "../../hooks/useCars";
import { recalcAll } from "../../utils/carCalc";

export default function CarEvaluationPage() {
  const { prices, updatePrice, savingPrices, loadPrices } = usePrices();
  const { cars, setCars, filters, setFilters, loadCars, catChoices } = useCars();
  const [sortBy, setSortBy] = useState("tco_per_month_8y");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => { loadPrices(); loadCars(); }, [loadPrices, loadCars]);
  useEffect(() => { setCars(prev => recalcAll(prev, prices)); }, [prices, setCars]);

  const sortedCars = useMemo(() => {
    const getVal = (car, key) => {
      const v = car[key];
      return Number.isFinite(v) ? v : typeof v === "string" ? v.toLowerCase() : 0;
    };
    const list = [...cars];
    return list.sort((a, b) => {
      const va = getVal(a, sortBy), vb = getVal(b, sortBy);
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [cars, sortBy, sortDir]);

  return (
    <div className="p-4 space-y-4">

      <EnergyFuelPanel prices={prices} updatePrice={updatePrice} saving={savingPrices} />

      <Filters filters={filters} setFilters={setFilters} catChoices={catChoices} />

      <CarsTable
        cars={sortedCars}
        setCars={setCars}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={(key) => setSortBy(s => (key !== s ? key : s)) || setSortDir(d => (key !== sortBy ? "asc" : (d === "asc" ? "desc" : "asc")))}
        prices={prices}
      />
    </div>
  );
}
