// components/car-evaluation/CarRow.jsx
import { rowBgFor } from "../../utils/vehicleTypeStyles";
import { brandBgClass, canonicalBrand } from "../../utils/brandColors";
import { priceBg } from "../../utils/priceStyles";
import { toFixed1 } from "../../utils/format";
import { normType, TYPE_CHOICES } from "../../utils/normalizers";
import { energyFuelCostYear } from "../../utils/carCalc.jsx";

export default function CarRow({
  car,
  onChange,
  fmt0,
  fieldColor,
  NA,
  prices,
}) {
  const type = normType(car.type_of_vehicle);
  const showKwh = type === "ev" || type === "phev";
  const showLitres = type !== "ev";
  const isEVlike = type.includes("ev");
  const rowBg = rowBgFor(car.type_of_vehicle);

  // ---- helpers -------------------------------------------------------------

  // For spec-like numeric inputs where 0 means “unknown”, render blank
  const blankIfZero = (v) => (v == null || Number(v) === 0 ? "" : v);

  // For text inputs
  const handleStr = (key) => (e) => onChange(key, e.target.value);

  // For number inputs: allow blank -> null; otherwise pass raw string (parent can cast)
  const handleNum = (key) => (e) => {
    const v = e.target.value;
    onChange(key, v === "" ? null : v);
  };

  // Read with graceful fallback but still blank-out zero
  const readSpec = (...keys) => {
    for (const k of keys) {
      const v = car?.[k];
      if (v != null && v !== "") return blankIfZero(v);
    }
    return "";
  };

  // Derived formatter that hides 0 if it's likely “unknown”
  const fmtDerived = (v) => (v == null || Number(v) === 0 ? "" : fmt0(v));

  // Energy cost: hide if looks unknown (both cons missing/zero)
  const energyCost = energyFuelCostYear(car, prices);
  const hasAnyConsumption =
    (Number(car?.consumption_kwh_per_100km) || 0) > 0 ||
    (Number(car?.consumption_l_per_100km) || 0) > 0;

  // ---- “display” values (avoid showing 0s) --------------------------------
  const vKwh100 = readSpec("consumption_kwh_per_100km", "consumption");
  const vL100 = readSpec("consumption_l_per_100km", "l_per_100km");
  const vBatt = readSpec("battery_capacity_kwh");
  const vDcPeak = readSpec("dc_peak_kw");
  const vDcTime = readSpec("dc_time_min_10_80"); // (no _est here per your latest)
  const vAcOnboard = readSpec("ac_onboard_kw");
  const vAcTime = readSpec("ac_time_h_0_100");
  const vRange = readSpec("range_km", "range");
  const vAccel = readSpec("acceleration_0_100");
  const vTrunk = readSpec("trunk_size_litre");
  const vPrice = readSpec("estimated_purchase_price");
  const vSummer = readSpec("summer_tires_price");
  const vWinter = readSpec("winter_tires_price");
  const vInsFull = readSpec("full_insurance_year");
  const vInsHalf = readSpec("half_insurance_year");
  const vTax = readSpec("car_tax_year");
  const vRepairs = readSpec("repairs_year");

  return (
    <tr className={`${rowBg} transition-colors`} data-type={car.type_of_vehicle}>
      {/* Model (frozen) */}
      <td
        className={`border px-2 py-1 sticky left-0 z-30 w-[18rem]
                    shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.06)] ${brandBgClass(
                      car.model
                    )}`}
        title={canonicalBrand(car.model) || undefined}
      >
        <input
          className="w-full border px-1 font-bold bg-transparent focus:bg-white/70"
          value={car.model ?? ""}
          onChange={handleStr("model")}
        />
      </td>

      {/* Year */}
      <td className="border px-2 py-1 text-right">
        <input
          type="number"
          className="w-24 border px-1 text-right"
          value={blankIfZero(car.year)}
          onChange={handleNum("year")}
        />
      </td>

      {/* Type */}
      <td className="border px-2 py-1 bg-inherit">
        <select
          className="border px-1 w-32 bg-inherit focus:bg-inherit focus:ring-0"
          value={car.type_of_vehicle || "EV"}
          onChange={handleStr("type_of_vehicle")}
        >
          {TYPE_CHOICES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </td>

      {/* Price & tires */}
      <td className="border px-2 py-1 text-right">
        <input
          type="number"
          className={`w-28 border px-1 text-right ${priceBg(
            car.estimated_purchase_price
          )} focus:ring-2 focus:ring-black/20`}
          value={vPrice}
          onChange={handleNum("estimated_purchase_price")}
        />
      </td>

      <td className="border px-2 py-1 text-right">
        <input
          type="number"
          className="w-24 border px-1 text-right"
          value={vSummer}
          onChange={handleNum("summer_tires_price")}
        />
      </td>

      <td className="border px-2 py-1 text-right">
        <input
          type="number"
          className="w-24 border px-1 text-right"
          value={vWinter}
          onChange={handleNum("winter_tires_price")}
        />
      </td>

      {/* kWh/100km */}
      <td className="border px-2 py-1 text-right">
        {showKwh ? (
          <input
            type="number"
            step="0.1"
            className="w-24 border px-1 text-right"
            value={vKwh100}
            onChange={handleNum("consumption_kwh_per_100km")}
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
            value={vL100}
            onChange={handleNum("consumption_l_per_100km")}
            title="Fuel consumption (L/100km)"
          />
        ) : (
          <NA hint="Not used for EV" />
        )}
      </td>

      {/* Battery */}
      <td className="border px-2 py-1 text-right">
        {isEVlike ? (
          <input
            type="number"
            step="0.1"
            min="0"
            className="w-24 border px-1 text-right"
            value={
              vBatt === ""
                ? ""
                : toFixed1(Number.isFinite(+vBatt) ? +vBatt : vBatt)
            }
            onChange={handleNum("battery_capacity_kwh")}
            title="Battery capacity (kWh)"
          />
        ) : (
          <NA hint="Not applicable for Diesel/Bensin" />
        )}
      </td>

      {/* DC peak */}
      <td className="border px-2 py-1 text-right">
        {isEVlike ? (
          <input
            type="number"
            step="0.1"
            className="w-24 border px-1 text-right"
            value={vDcPeak}
            onChange={handleNum("dc_peak_kw")}
            title="Peak DC fast-charge power (kW)"
          />
        ) : (
          <NA hint="Not applicable for ICE" />
        )}
      </td>

      {/* DC 10→80 (minutes) */}
      <td className="border px-2 py-1 text-right">
        {isEVlike ? (
          <input
            type="number"
            step="0.1"
            className={`w-24 border px-1 text-right ${fieldColor(
              "dc_time_min_10_80",
              vDcTime
            )}`}
            value={vDcTime}
            onChange={handleNum("dc_time_min_10_80")}
            title="DC 10→80% (minutes)"
          />
        ) : (
          <NA hint="Not applicable for ICE" />
        )}
      </td>

      {/* AC onboard (kW) */}
      <td className="border px-2 py-1 text-right">
        {isEVlike ? (
          <input
            type="number"
            step="0.1"
            className="w-24 border px-1 text-right"
            value={vAcOnboard}
            onChange={handleNum("ac_onboard_kw")}
            title="Onboard AC charger (kW)"
          />
        ) : (
          <NA hint="Not applicable for ICE" />
        )}
      </td>

      {/* AC 0→100 (hours) */}
      <td className="border px-2 py-1 text-right">
        {isEVlike ? (
          <input
            type="number"
            step="0.1"
            className={`w-24 border px-1 text-right ${fieldColor(
              "ac_time_h_0_100",
              vAcTime
            )}`}
            value={vAcTime}
            onChange={handleNum("ac_time_h_0_100")}
            title="AC 0→100% (hours)"
          />
        ) : (
          <NA hint="Not applicable for ICE" />
        )}
      </td>

      {/* Energy & fuel / year */}
      <td className="border px-2 py-1 text-right">
        {energyCost > 0 && hasAnyConsumption ? fmt0(energyCost) : ""}
      </td>

      {/* WLTP Range (km) */}
      <td className="border px-2 py-1 text-right">
        {isEVlike ? (
          <input
            type="number"
            className={`w-24 border px-1 text-right ${fieldColor(
              "range",
              vRange
            )}`}
            value={vRange}
            onChange={handleNum("range_km")}
            title="WLTP electric range (km)"
          />
        ) : (
          <NA hint="Not applicable for ICE" />
        )}
      </td>

      {/* Accel 0–100 */}
      <td className="border px-2 py-1 text-right">
        <input
          type="number"
          className={`w-24 border px-1 text-right ${fieldColor(
            "acceleration_0_100",
            vAccel
          )}`}
          value={vAccel}
          onChange={handleNum("acceleration_0_100")}
          title="0–100 km/h (s)"
        />
      </td>

      {/* Trunk */}
      <td className="border px-2 py-1 text-right">
        <input
          type="number"
          className={`w-24 border px-1 text-right ${fieldColor(
            "trunk_size_litre",
            vTrunk
          )}`}
          value={vTrunk}
          onChange={handleNum("trunk_size_litre")}
        />
      </td>

      {/* Costs */}
      <td className="border px-2 py-1 text-right">
        <input
          type="number"
          className={`w-24 border px-1 text-right ${fieldColor(
            "full_insurance_year",
            vInsFull
          )}`}
          value={vInsFull}
          onChange={handleNum("full_insurance_year")}
        />
      </td>
      <td className="border px-2 py-1 text-right">
        <input
          type="number"
          className={`w-24 border px-1 text-right ${fieldColor(
            "half_insurance_year",
            vInsHalf
          )}`}
          value={vInsHalf}
          onChange={handleNum("half_insurance_year")}
        />
      </td>
      <td className="border px-2 py-1 text-right">
        <input
          type="number"
          className={`w-24 border px-1 text-right ${fieldColor(
            "car_tax_year",
            vTax
          )}`}
          value={vTax}
          onChange={handleNum("car_tax_year")}
        />
      </td>
      <td className="border px-2 py-1 text-right">
        <input
          type="number"
          min="0"
          step="1"
          className={`w-24 border px-1 text-right ${fieldColor(
            "repairs_year",
            vRepairs
          )}`}
          value={vRepairs}
          onChange={handleNum("repairs_year")}
        />
      </td>

      {/* Derived / TCO */}
      <td className="border px-2 py-1 text-right">
        {fmtDerived(car.expected_value_after_3y)}
      </td>
      <td className="border px-2 py-1 text-right">
        {fmtDerived(car.expected_value_after_5y)}
      </td>
      <td className="border px-2 py-1 text-right">
        {fmtDerived(car.expected_value_after_8y)}
      </td>
      <td className="border px-2 py-1 text-right">
        {fmtDerived(car.tco_total_3y)}
      </td>
      <td className="border px-2 py-1 text-right">
        {fmtDerived(car.tco_total_5y)}
      </td>
      <td className="border px-2 py-1 text-right">
        {fmtDerived(car.tco_total_8y)}
      </td>
      <td className="border px-2 py-1 text-right">
        {fmtDerived(car.tco_per_month_3y)}
      </td>
      <td className="border px-2 py-1 text-right">
        {fmtDerived(car.tco_per_month_5y)}
      </td>
      <td className="border px-2 py-1 text-right">
        {fmtDerived(car.tco_per_month_8y)}
      </td>
    </tr>
  );
}
