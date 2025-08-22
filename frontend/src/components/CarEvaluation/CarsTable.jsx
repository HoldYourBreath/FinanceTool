import { recalcRow } from "../../utils/carCalc";
import { toNum, fmt0 } from "../../utils/format";
import { fieldColor, NA } from "../../utils/carCost";
import CarRow from "./CarRow";

function Header({ label, sortKey, align = "text-right", extra = "", onSort, sortBy, sortDir }) {
  return (
    <th
      className={`border px-2 py-1 ${align} cursor-pointer select-none sticky top-0 z-40 bg-gray-100 whitespace-pre-line break-words leading-tight ${extra}`}
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

  // Explicit widths for key columns so table-fixed doesn't "gift" them extra width.
  // Index must match the visual order of columns below.
  const COL_WIDTHS = [
    "w-[22rem]",    // 1) Car Model (sticky; keep wide)
    "w-[6ch] md:w-[7ch]", // 2) Year (narrow)
    "w-20 md:w-24", // 3) Type (narrow)
    "w-24",         // 4) Price (SEK)
    "w-16",         // 5) Summer Tires
    "w-16",         // 6) Winter Tires
    "w-28",         // 7) Consumption (kWh/100km)
    "w-28",         // 8) Consumption (l/100km)
    "w-20",         // 9) Battery (kWh)
    "w-20",         // 10) DC Peak (kW)
    "w-24",         // 11) DC 10→80 (min)
    "w-20",         // 12) AC Onboard (kW)
    "w-20",         // 13) AC 0→100 (h)
    "w-32",         // 14) Consumption (SEK) / year
    "w-24",         // 15) WLTP Range (km)
    "w-24",         // 16) Acceleration (0–100)
    "w-16",         // 17) Trunk Size (l)  <-- forced narrow
    // Remaining columns will auto-share leftover width
  ];

  return (
    <div className="relative max-h-[72vh] overflow-auto border rounded">
      <table className="table-fixed border-separate border-spacing-0">
        <colgroup>
          {COL_WIDTHS.map((cls, i) => (
            <col key={i} className={cls} />
          ))}
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
              extra="left-0 z-50 w-[22rem] min-w-[22rem] max-w-[22rem] shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.06)]"
            />
            <Header label="Year" sortKey="year" sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
            <Header label="Type" sortKey="type_of_vehicle" align="text-left" sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
            <Header label={"Price\n(SEK)"} sortKey="estimated_purchase_price" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Summer\nTires\n(SEK)"} sortKey="summer_tires_price" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Winter\nTires\n(SEK)"} sortKey="winter_tires_price" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Consumption\n(kWh/100km)"} sortKey="consumption_kwh_per_100km" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Consumption\n(l/100km)"} sortKey="consumption_l_per_100km" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Battery\n(kWh)"} sortKey="battery_capacity_kwh" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"DC Peak\n(kW)"} sortKey="dc_peak_kw" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"DC 10→80\n(min)"} sortKey="dc_time_min_10_80" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"AC Onboard\n(kW)"} sortKey="ac_onboard_kw" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"AC 0→100\n(h)"} sortKey="ac_time_h_0_100" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Consumptionmp.\n(SEK) / year"} sortKey="energy_fuel_year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"WLTP (EV)\nRange (km)"} sortKey="range" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Acceleration\n(0–100 km/h)"} sortKey="acceleration_0_100" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Trunk Size\n(l)"} sortKey="trunk_size_litre" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Full Insurance\n/ Year"} sortKey="full_insurance_year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Half Insurance\n/ Year"} sortKey="half_insurance_year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Car Tax\n/ Year"} sortKey="car_tax_year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Repairs\n/ Year"} sortKey="repairs_year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Value\n(3y)"} sortKey="expected_value_after_3y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Value\n(5y)"} sortKey="expected_value_after_5y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"Value\n(8y)"} sortKey="expected_value_after_8y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"TCO Total\n(3y)"} sortKey="tco_total_3y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"TCO Total\n(5y)"} sortKey="tco_total_5y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"TCO Total\n(8y)"} sortKey="tco_total_8y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"TCO / mo\n(3y)"} sortKey="tco_per_month_3y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"TCO / mo\n(5y)"} sortKey="tco_per_month_5y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Header label={"TCO / mo\n(8y)"} sortKey="tco_per_month_8y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
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
