import { toFixed1 } from "../../utils/format";
import { normType, pickOfficialOrEst, TYPE_CHOICES } from "../../utils/normalizers";
import { energyFuelCostYear } from "../../utils/carCalc.jsx";

export default function CarRow({ car, idx, onChange, fmt0, fieldColor, NA, prices }) {
  const type       = normType(car.type_of_vehicle);
  const showKwh    = type === "ev" || type === "phev";
  const showLitres = type !== "ev";
  const isEVlike   = type.includes("ev"); // ev or phev

  return (
    <tr>
      {/* Frozen first column cell */}
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
        <input type="number" className="w-24 border px-1 text-right" value={car.year}
               onChange={(e) => onChange(idx, "year", e.target.value)} />
      </td>

      {/* Type */}
      <td className="border px-2 py-1">
        <select className="border px-1 w-28" value={car.type_of_vehicle || "EV"}
                onChange={(e) => onChange(idx, "type_of_vehicle", e.target.value)}>
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
                  {p.isEst && <span className="text-xs text-gray-500 italic"></span>}
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
                  {p.isEst && <span className="text-xs text-gray-500 italic"></span>}
                </>
              );
            })()}
          </div>
        ) : <NA hint="Not applicable for ICE" />}
      </td>

      {/* Energy & fuel / year */}
      <td className="border px-2 py-1 text-right">{fmt0(energyFuelCostYear(car, prices))}</td>

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
}
