// EnergyFuelFinancingRow.jsx
import React from "react";

export default function EnergyFuelFinancingRow({ prices, updatePrice }) {
  // Small, readable labels
  const labelCls = "block mb-1 text-[11px] font-medium text-slate-600";
  // Compact input styling
  const inputCls =
    "h-9 w-full rounded-md border border-sky-200 bg-white/70 " +
    "px-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400";

  return (
    <section className="-mx-4 px-4 mb-3" data-testid="energy-bar">
      {/* Responsive grid: one line on xl, wraps gracefully below xl */}
      <div className="grid gap-4 items-end
                      grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Field
          id="el_price_ore_kwh"
          label="Electricity Price (öre/kWh)"
          value={prices.el_price_ore_kwh}
          onChange={(v) => updatePrice({ el_price_ore_kwh: v })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="any"
        />

        <Field
          id="bensin_price_sek_litre"
          label="Bensin (SEK/litre)"
          value={prices.bensin_price_sek_litre}
          onChange={(v) => updatePrice({ bensin_price_sek_litre: v })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="0.01"
        />

        <Field
          id="diesel_price_sek_litre"
          label="Diesel (SEK/litre)"
          value={prices.diesel_price_sek_litre}
          onChange={(v) => updatePrice({ diesel_price_sek_litre: v })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="0.01"
        />

        <Field
          id="yearly_km"
          label="Yearly driving (km)"
          value={prices.yearly_km}
          onChange={(v) => updatePrice({ yearly_km: v })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="1"
        />

        <Field
          id="daily_commute_km"
          label="Daily commute (km)"
          value={prices.daily_commute_km}
          onChange={(v) => updatePrice({ daily_commute_km: v })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="1"
        />

        {/* Financing */}
        <Field
          id="downpayment_pct"
          label="Downpayment (%)"
          value={prices.downpayment_pct ?? 0}
          onChange={(v) => updatePrice({ downpayment_pct: v })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          max={100}
          step="1"
        />

        <Field
          id="interest_rate_pct"
          label="Interest rate (% / year)"
          value={prices.interest_rate_pct ?? 0}
          onChange={(v) => updatePrice({ interest_rate_pct: v })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="0.01"
        />
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = "any",
  inputCls = "",
  labelCls = "",
}) {
  return (
    <div className="min-w-[11rem]">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        autoComplete="off"
        className={inputCls}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
