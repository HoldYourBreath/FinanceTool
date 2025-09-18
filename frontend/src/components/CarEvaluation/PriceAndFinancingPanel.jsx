// EnergyFuelFinancingRow.jsx
import React from "react";

export default function EnergyFuelFinancingRow({ prices = {}, updatePrice }) {
  const labelCls = "block mb-1 text-[11px] font-medium text-slate-600";
  const inputCls =
    "h-9 w-full rounded-md border border-sky-200 bg-white/70 " +
    "px-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400";

  // UI fallbacks (also match backend defaults)
  const F = {
    el_price_ore_kwh: 250,
    bensin_price_sek_litre: 14,
    diesel_price_sek_litre: 15,
    yearly_km: 18000,
    daily_commute_km: 30,
    downpayment_sek: 0,
    interest_rate_pct: 5.0,
  };

  return (
    <section className="-mx-4 px-4 mb-3" data-testid="energy-bar">
      {/* One line on xl; wraps below */}
      <div className="grid gap-4 items-end grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Field
          id="el_price_ore_kwh"
          label="Electricity Price (öre/kWh)"
          value={prices.el_price_ore_kwh ?? F.el_price_ore_kwh}
          onCommit={(n) => updatePrice({ el_price_ore_kwh: n })}
          inputCls={inputCls}
          labelCls={labelCls}
        />

        <Field
          id="bensin_price_sek_litre"
          label="Bensin (SEK/litre)"
          value={prices.bensin_price_sek_litre ?? F.bensin_price_sek_litre}
          onCommit={(n) => updatePrice({ bensin_price_sek_litre: n })}
          step="0.01"
          inputCls={inputCls}
          labelCls={labelCls}
        />

        <Field
          id="diesel_price_sek_litre"
          label="Diesel (SEK/litre)"
          value={prices.diesel_price_sek_litre ?? F.diesel_price_sek_litre}
          onCommit={(n) => updatePrice({ diesel_price_sek_litre: n })}
          step="0.01"
          inputCls={inputCls}
          labelCls={labelCls}
        />

        <Field
          id="yearly_km"
          label="Yearly driving (km)"
          value={prices.yearly_km ?? F.yearly_km}
          onCommit={(n) => updatePrice({ yearly_km: Math.max(0, Math.round(n)) })}
          step="1"
          inputCls={inputCls}
          labelCls={labelCls}
        />

        <Field
          id="daily_commute_km"
          label="Daily commute (km)"
          value={prices.daily_commute_km ?? F.daily_commute_km}
          onCommit={(n) => updatePrice({ daily_commute_km: Math.max(0, Math.round(n)) })}
          step="1"
          inputCls={inputCls}
          labelCls={labelCls}
        />

        {/* Financing */}
        <Field
          id="downpayment_sek"
          label="Downpayment (SEK)"
          value={prices.downpayment_sek ?? F.downpayment_sek}
          onCommit={(n) => updatePrice({ downpayment_sek: Math.max(0, Math.round(n)) })}
          step="1"
          inputCls={inputCls}
          labelCls={labelCls}
          dataTestId="input-downpayment-sek"
        />

        <Field
          id="interest_rate_pct"
          label="Interest rate (% / year)"
          value={prices.interest_rate_pct ?? F.interest_rate_pct}
          onCommit={(n) => updatePrice({ interest_rate_pct: Math.max(0, n) })}
          step="0.01"
          inputCls={inputCls}
          labelCls={labelCls}
          dataTestId="input-interest-rate"
        />
      </div>
    </section>
  );
}

/**
 * Field: text input that accepts both "," and "." decimals.
 * - Keeps local string while typing (can be empty).
 * - Calls onCommit(number) when the typed value parses to a finite number
 *   onChange (valid), onBlur, or when pressing Enter.
 */
function Field({
  id,
  label,
  value,
  onCommit,
  step = "any",
  inputCls = "",
  labelCls = "",
  dataTestId,
}) {
  const [raw, setRaw] = React.useState(toDisplay(value));

  // Sync local text if parent value changes externally
  React.useEffect(() => {
    setRaw(toDisplay(value));
  }, [value]);

  const commitIfValid = (s) => {
    const n = parseDecimal(s);
    if (Number.isFinite(n)) onCommit(n);
  };

  return (
    <div className="min-w-[11rem]">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <input
        id={id}
        // use text so users can type commas or partial decimals; keep numeric keyboard
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={inputCls}
        value={raw}
        step={step}
        data-testid={dataTestId}
        onChange={(e) => {
          const s = e.target.value;
          setRaw(s);
          // live-commit only when parsable; otherwise let user keep typing
          const n = parseDecimal(s);
          if (Number.isFinite(n)) onCommit(n);
        }}
        onBlur={() => {
          // on blur: normalize & commit; if not valid, snap back to last good display
          const n = parseDecimal(raw);
          if (Number.isFinite(n)) {
            onCommit(n);
            setRaw(toDisplay(n));
          } else {
            setRaw(toDisplay(value));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

// ---- helpers ----
function parseDecimal(s) {
  if (s == null) return NaN;
  const trimmed = String(s).trim();
  if (!trimmed) return NaN;
  // remove spaces (incl. non-breaking), convert comma to dot
  const normalized = trimmed.replace(/\s|\u00A0/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function toDisplay(v) {
  if (v == null || v === "") return "";
  // keep original precision as string
  const n = Number(v);
  return Number.isFinite(n) ? String(v) : "";
}
