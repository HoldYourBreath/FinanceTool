import { recalcRow } from "../../utils/carCalc";
import { toNum, fmt0 } from "../../utils/format";
import { fieldColor, NA } from "../../utils/carCost";
import CarRow from "./CarRow";

function Header({ label, sortKey, align = "text-right", extra = "", onSort, sortBy, sortDir }) {
  return (
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
}

export default function CarsTable({ cars, setCars, sortBy, sortDir, onSort, prices }) {
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

  const onChange = (idx, field, value) => {
    setCars((prev) => {
      const next = [...prev];
      let v = value;
      if (!["model", "type_of_vehicle", "dc_time_source", "ac_time_source"].includes(field)) v = toNum(value);
      next[idx] = recalcRow({ ...next[idx], [field]: v }, prices);
      return next;
    });
  };

  return (
    <div className="relative max-h-[72vh] overflow-auto border rounded">
      <table className="min-w-max table-fixed border-separate border-spacing-0">
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
              onSort={onSort}
              extra="left-0 z-50 w-[18rem] shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.06)]"
            />
            <Header label="Year" sortKey="year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Type" sortKey="type_of_vehicle" align="text-left" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Estimated Purchase Price" sortKey="estimated_purchase_price" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Summer Tires Price" sortKey="summer_tires_price" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Winter Tires Price" sortKey="winter_tires_price" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Consumption (kWh/100km)" sortKey="consumption_kwh_per_100km" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Consumption (l/100km)" sortKey="consumption_l_per_100km" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Battery (kWh)" sortKey="battery_capacity_kwh" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="DC Peak (kW)" sortKey="dc_peak_kw" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="DC 10→80 (min)" sortKey="dc_time_min_10_80" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="AC Onboard (kW)" sortKey="ac_onboard_kw" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="AC 0→100 (h)" sortKey="ac_time_h_0_100" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Energy & Fuel Price (SEK) / year" sortKey="energy_fuel_year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="WLTP (EV) Range (km)" sortKey="range" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Acceleration (0–100 km/h)" sortKey="acceleration_0_100" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Trunk Size (l)" sortKey="trunk_size_litre" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Full Insurance / Year" sortKey="full_insurance_year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Half Insurance / Year" sortKey="half_insurance_year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Car Tax / Year" sortKey="car_tax_year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Repairs / Year" sortKey="repairs_year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Expected Value (3y)" sortKey="expected_value_after_3y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Expected Value (5y)" sortKey="expected_value_after_5y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="Expected Value (8y)" sortKey="expected_value_after_8y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="TCO Total (3y)" sortKey="tco_total_3y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="TCO Total (5y)" sortKey="tco_total_5y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="TCO Total (8y)" sortKey="tco_total_8y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="TCO / mo (3y)" sortKey="tco_per_month_3y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="TCO / mo (5y)" sortKey="tco_per_month_5y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label="TCO / mo (8y)" sortKey="tco_per_month_8y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          </tr>
        </thead>

        <tbody>
          {sortedCars.map((car, idx) => (
            <CarRow
              key={car.id}
              car={car}
              idx={idx}
              onChange={onChange}
              fmt0={fmt0}
              fieldColor={fieldColor}
              NA={NA}
              prices={prices}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
