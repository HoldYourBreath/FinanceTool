// EnergyFuelFinancingRow.jsx
import React from "react";

export default function EnergyFuelFinancingRow({ prices = {}, updatePrice }) {
  // Small, readable labels
  const labelCls = "block mb-1 text-[11px] font-medium text-slate-600";
  // Compact input styling
  const inputCls =
    "h-9 w-full rounded-md border border-sky-200 bg-white/70 " +
    "px-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400";

  // local helper to coerce numbers safely
  const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  return (
    <section className="-mx-4 px-4 mb-3" data-testid="energy-bar">
      {/* Responsive grid: one line on xl, wraps gracefully below xl */}
      <div className="grid gap-4 items-end grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Field
          id="el_price_ore_kwh"
          label="Electricity Price (öre/kWh)"
          value={prices.el_price_ore_kwh ?? 250}
          onChange={(v) => updatePrice({ el_price_ore_kwh: toNum(v) })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="any"
        />

        <Field
          id="bensin_price_sek_litre"
          label="Bensin (SEK/litre)"
          value={prices.bensin_price_sek_litre ?? 14}
          onChange={(v) => updatePrice({ bensin_price_sek_litre: toNum(v) })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="0.01"
        />

        <Field
          id="diesel_price_sek_litre"
          label="Diesel (SEK/litre)"
          value={prices.diesel_price_sek_litre ?? 15}
          onChange={(v) => updatePrice({ diesel_price_sek_litre: toNum(v) })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="0.01"
        />

        <Field
          id="yearly_km"
          label="Yearly driving (km)"
          value={prices.yearly_km ?? 18000}
          onChange={(v) => updatePrice({ yearly_km: toNum(v) })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="1"
        />

        <Field
          id="daily_commute_km"
          label="Daily commute (km)"
          value={prices.daily_commute_km ?? 30}
          onChange={(v) => updatePrice({ daily_commute_km: toNum(v) })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="1"
        />

        {/* Financing */}
        <Field
          id="downpayment_sek"
          label="Downpayment (SEK)"
          value={prices.downpayment_sek ?? 0}
          onChange={(v) => updatePrice({ downpayment_sek: toNum(v) })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="1"
          dataTestId="input-downpayment-sek"
        />

        <Field
          id="interest_rate_pct"
          label="Interest rate (% / year)"
          value={prices.interest_rate_pct ?? 5.0}
          onChange={(v) => updatePrice({ interest_rate_pct: toNum(v) })}
          inputCls={inputCls}
          labelCls={labelCls}
          min={0}
          step="0.01"
          dataTestId="input-interest-rate"
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
  dataTestId,
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
        data-testid={dataTestId}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
