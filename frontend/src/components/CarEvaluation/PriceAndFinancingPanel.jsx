// EnergyFuelPanel.jsx

export default function PriceAndFinancingPanel({ prices, updatePrice }) {
  const labelCls = "block mb-1 text-sm font-semibold text-slate-700";
  const inputCls =
    "w-full rounded-lg border border-sky-200 bg-white/70 px-3 py-2 text-sm shadow-inner " +
    "focus:outline-none focus:ring-2 focus:ring-sky-400";

  return (
    <section className="rounded-2xl bg-sky-50/70 ring-1 ring-sky-200 p-4 shadow-sm backdrop-blur-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        Energy, Fuel &amp; Financing
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div>
          <label htmlFor="el_price_ore_kwh" className={labelCls}>
            Electricity Price (öre/kWh)
          </label>
          <input
            id="el_price_ore_kwh"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            autoComplete="off"
            className={inputCls}
            value={prices.el_price_ore_kwh}
            onChange={(e) =>
              updatePrice({ el_price_ore_kwh: Number(e.target.value) || 0 })
            }
          />
        </div>

        <LabeledNumber
          id="bensin_price_sek_litre"
          label="Bensin (SEK/litre)"
          value={prices.bensin_price_sek_litre}
          onChange={(v) => updatePrice({ bensin_price_sek_litre: v })}
          min={0}
          step="0.01"
          inputCls={inputCls}
          labelCls={labelCls}
        />

        <LabeledNumber
          id="diesel_price_sek_litre"
          label="Diesel (SEK/litre)"
          value={prices.diesel_price_sek_litre}
          onChange={(v) => updatePrice({ diesel_price_sek_litre: v })}
          min={0}
          step="0.01"
          inputCls={inputCls}
          labelCls={labelCls}
        />

        <LabeledNumber
          id="yearly_km"
          label="Yearly driving (km)"
          value={prices.yearly_km}
          onChange={(v) => updatePrice({ yearly_km: v })}
          min={0}
          step="1"
          inputCls={inputCls}
          labelCls={labelCls}
        />

        <LabeledNumber
          id="daily_commute_km"
          label="Daily commute (km)"
          value={prices.daily_commute_km}
          onChange={(v) => updatePrice({ daily_commute_km: v })}
          min={0}
          step="1"
          inputCls={inputCls}
          labelCls={labelCls}
        />

        {/* --- Financing --- */}
        <LabeledNumber
          id="loan_downpayment_sek"
          label="Downpayment (SEK)"
          value={prices.loan_downpayment_sek ?? 0}
          onChange={(v) => updatePrice({ loan_downpayment_sek: v })}
          min={0}
          step="1"
          inputCls={inputCls}
          labelCls={labelCls}
        />

        <LabeledNumber
          id="loan_interest_rate_percent"
          label="Interest rate (%)"
          value={prices.loan_interest_rate_percent ?? 0}
          onChange={(v) => updatePrice({ loan_interest_rate_percent: v })}
          min={0}
          step="0.01"
          inputCls={inputCls}
          labelCls={labelCls}
        />
      </div>
    </section>
  );
}

function LabeledNumber({
  id,
  label,
  value,
  onChange,
  min = 0,
  step = "any",
  inputCls = "",
  labelCls = "",
}) {
  return (
    <div>
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
        step={step}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
