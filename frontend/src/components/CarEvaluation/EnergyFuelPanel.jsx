export default function EnergyFuelPanel({ prices, updatePrice, saving }) {
  const elSekPerKwh = (Number(prices.el_price_ore_kwh) || 0) / 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-3 bg-white rounded border shadow">
      <div>
        <label htmlFor="el_price_ore_kwh" className="block text-sm font-semibold mb-1">Electricity Price (öre/kWh)</label>
        <input id="el_price_ore_kwh" type="number" className="w-full border rounded px-2 py-1"
               value={prices.el_price_ore_kwh}
               onChange={(e) => updatePrice({ el_price_ore_kwh: Number(e.target.value) || 0 })}/>
        <div className="text-xs text-gray-600 mt-1">≈ {elSekPerKwh.toFixed(1)} SEK/kWh</div>
      </div>
      <LabeledNumber id="bensin_price_sek_litre" label="Bensin (SEK/litre)"
        value={prices.bensin_price_sek_litre} onChange={(v)=>updatePrice({bensin_price_sek_litre:v})}/>
      <LabeledNumber id="diesel_price_sek_litre" label="Diesel (SEK/litre)"
        value={prices.diesel_price_sek_litre} onChange={(v)=>updatePrice({diesel_price_sek_litre:v})}/>
      <LabeledNumber id="yearly_km" label="Yearly driving (km)"
        value={prices.yearly_km} onChange={(v)=>updatePrice({yearly_km:v})}/>
      <LabeledNumber id="daily_commute_km" label="Daily commute (km)"
        value={prices.daily_commute_km} onChange={(v)=>updatePrice({daily_commute_km:v})}/>
      <div className="md:col-span-3 lg:col-span-5 text-sm text-gray-600">{saving ? "Saving…" : "Saved"}</div>
    </div>
  );
}

function LabeledNumber({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold mb-1">{label}</label>
      <input id={id} type="number" className="w-full border rounded px-2 py-1"
             value={value} onChange={(e)=>onChange(Number(e.target.value)||0)} />
    </div>
  );
}
