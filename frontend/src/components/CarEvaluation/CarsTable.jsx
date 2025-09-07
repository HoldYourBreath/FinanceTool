import { recalcRow } from "../../utils/carCalc";
import { toNum, fmt0 } from "../../utils/format";
import { fieldColor, NA } from "../../utils/carCost";
import CarRow from "./CarRow";

const pick = (obj, ...keys) => keys.map(k => obj?.[k]).find(v => v !== undefined && v !== null);

const asNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function Header({
  label,
  sortKey,
  align = "text-right",
  extra = "",
  onSort,
  sortBy,
  sortDir,
}) {
  const isActive = sortBy === sortKey;
  const arrow = isActive ? (sortDir === "asc" ? "▲" : "▼") : "";
  const ariaSort = isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th
      role="columnheader"
      aria-sort={ariaSort}
      className={[
        "px-2 py-2",
        "sticky top-0 z-40",
        "bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60",
        "text-xs font-semibold uppercase tracking-wide text-slate-700",
        "border-b border-slate-200",
        "whitespace-pre-line break-words leading-tight",
        "cursor-pointer select-none",
        align,
        extra,
      ].join(" ")}
      onClick={() => onSort(sortKey)}
      title="Click to sort"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-slate-400">{arrow}</span>
      </span>
    </th>
  );
}

export default function CarsTable({ cars, setCars, sortBy, sortDir, onSort, prices }) {
  // --- value getter with unified consumption key ---
  const getVal = (car, key) => {
    const isKwhKey = key === "consumption_kwh_100km" || key === "consumption_kwh_per_100km";
    const raw = isKwhKey
      ? pick(car, "consumption_kwh_100km", "consumption_kwh_per_100km")
      : car[key];

    const n = asNum(raw);
    if (n !== null) return n;                 // numeric sort
    if (typeof raw === "string") return raw.toLowerCase(); // alpha sort
    return null;                              // nulls sort last
  };

  // --- normalize both keys so downstream always has them ---
  const normalizedCars = cars.map(c => ({
    ...c,
    consumption_kwh_100km: c.consumption_kwh_100km ?? c.consumption_kwh_per_100km ?? null,
    consumption_kwh_per_100km: c.consumption_kwh_per_100km ?? c.consumption_kwh_100km ?? null,
  }));

  // --- sort with nulls last ---
  const sortedCars = [...normalizedCars].sort((a, b) => {
    const va = getVal(a, sortBy);
    const vb = getVal(b, sortBy);
    const asc = sortDir === "asc" ? 1 : -1;

    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;

    if (typeof va === "number" && typeof vb === "number") return asc * (va - vb);
    return asc * (va < vb ? -1 : va > vb ? 1 : 0);
  });

  // --- editing: numeric fields via toNum; mirror unified consumption keys ---
  const onChange = (idx, field, value) => {
    setCars((prev) => {
      const next = [...prev];
      const isTextField = ["model", "type_of_vehicle", "dc_time_source", "ac_time_source"].includes(field);
      const parsed = isTextField ? value : toNum(value);

      let patch = { [field]: parsed };

      // If user edits either consumption key, mirror to the other to keep state consistent
      if (field === "consumption_kwh_100km") {
        patch = { consumption_kwh_100km: parsed, consumption_kwh_per_100km: parsed };
      } else if (field === "consumption_kwh_per_100km") {
        patch = { consumption_kwh_per_100km: parsed, consumption_kwh_100km: parsed };
      }

      next[idx] = recalcRow({ ...next[idx], ...patch }, prices);
      return next;
    });
  };

  return (
    // 🔹 Full-bleed wrapper (restores edge-to-edge width inside a centered page)
    <div className="relative w-screen max-w-[100vw] -mx-[50vw] left-1/2 right-1/2 px-4 sm:px-6 lg:px-8">
      {/* Colored card that spans the full width */}
      <section className="rounded-2xl bg-cyan-50/70 ring-1 ring-cyan-200 p-3 shadow-sm backdrop-blur-sm">
        {/* Scroll container */}
        <div className="max-h-[72vh] overflow-auto rounded-lg ring-1 ring-white/50">
          <table className="w-full table-auto border-separate border-spacing-0">
            <thead>
              <tr>
                <Header
                  label="Car Model"
                  sortKey="model"
                  align="text-left"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  extra="left-0 z-50 w-[22rem] min-w-[22rem] shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.06)]"
                />
                <Header label="Year" sortKey="year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Header
                  label="Type"
                  sortKey="type_of_vehicle"
                  align="text-left"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <Header label={"Price\n(SEK)"} sortKey="estimated_purchase_price" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Header label={"Summer\nTires\n(SEK)"} sortKey="summer_tires_price" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Header label={"Winter\nTires\n(SEK)"} sortKey="winter_tires_price" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />

                {/* ✅ Use unified API key for sorting; getter supports both */}
                <Header
                  label={"Consumption\n(kWh/100km)"}
                  sortKey="consumption_kwh_100km"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                />

                <Header label={"Consumption\n(l/100km)"} sortKey="consumption_l_per_100km" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Header label={"Battery\n(kWh)"} sortKey="battery_capacity_kwh" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Header label={"DC Peak\n(kW)"} sortKey="dc_peak_kw" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Header label={"DC 10→80\n(min)"} sortKey="dc_time_min_10_80" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Header label={"AC Onboard\n(kW)"} sortKey="ac_onboard_kw" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Header label={"AC 0→100\n(h)"} sortKey="ac_time_h_0_100" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Header label={"Consumption\n(SEK) / year"} sortKey="energy_fuel_year" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
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

            <tbody className="[&>tr:hover]:bg-white/60 [&>tr]:odd:bg-white/40">
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
      </section>
    </div>
  );
}
