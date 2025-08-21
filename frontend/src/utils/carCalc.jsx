import { monthlyConsumptionCost } from "../utils/carCost";
import { toNum } from "../utils/format";

const depreciationRates = { 3: 0.15, 5: 0.25, 8: 0.4 };

export function energyFuelCostYear(car, prices) {
  const kmPerMonth = (Number(prices?.yearly_km) || 0) / 12;
  return monthlyConsumptionCost(car, kmPerMonth, {
    el_price_ore_kwh: prices?.el_price_ore_kwh,
    diesel_price_sek_litre: prices?.diesel_price_sek_litre,
    bensin_price_sek_litre: prices?.bensin_price_sek_litre,
    daily_commute_km: prices?.daily_commute_km,
  }) * 12;
}

export function calcTCO(car, years, prices) {
  const base = toNum(car.estimated_purchase_price);
  const depreciation = base * (depreciationRates[years] || 0);
  const months = years * 12;

  const energyFuelPerMonth = energyFuelCostYear(car, prices) / 12;
  const tiresPerMonth = months ? (toNum(car.summer_tires_price) + toNum(car.winter_tires_price)) / months : 0;
  const insurance = toNum(car.full_insurance_year) / 12;
  const repairs   = toNum(car.repairs_year) / 12;
  const tax       = toNum(car.car_tax_year) / 12;

  const runningPerMonth = energyFuelPerMonth + tiresPerMonth + insurance + repairs + tax;
  const runningTotal = runningPerMonth * months;

  return {
    total: runningTotal + depreciation,
    perMonth: months ? (runningTotal + depreciation) / months : 0,
    expectedValue: Math.max(0, base * (1 - (depreciationRates[years] || 0))),
  };
}

export function recalcRow(c, prices) {
  const t3 = calcTCO(c, 3, prices);
  const t5 = calcTCO(c, 5, prices);
  const t8 = calcTCO(c, 8, prices);
  return {
    ...c,
    energy_fuel_year: energyFuelCostYear(c, prices),
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
}

export function recalcAll(list, prices) {
  return list.map(c => recalcRow(c, prices));
}
