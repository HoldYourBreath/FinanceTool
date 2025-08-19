// src/components/Settings.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function Settings() {
  const [months, setMonths] = useState([]);
  const [currentMonthId, setCurrentMonthId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [prices, setPrices] = useState({
    el_price_ore_kwh: '',
    bensin_price_sek_litre: '',
    diesel_price_sek_litre: '',
    yearly_km: '',
    daily_commute_km: '', // NEW
  });
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // months
        const monthsRes = await api.get('/months/all');
        const ms = monthsRes.data || [];
        setMonths(ms);
        const current = ms.find((m) => m.is_current);
        if (current) setCurrentMonthId(String(current.id));

        // accounts
        const accountsRes = await api.get('/acc_info');
        setAccounts(accountsRes.data || []);

        // prices
        const pricesRes = await api.get('/settings/prices');
        const p = pricesRes.data || {};
        setPrices({
          el_price_ore_kwh: String(p.el_price_ore_kwh ?? ''),
          bensin_price_sek_litre: String(p.bensin_price_sek_litre ?? ''),
          diesel_price_sek_litre: String(p.diesel_price_sek_litre ?? ''),
          yearly_km: String(p.yearly_km ?? ''),
          daily_commute_km: String(p.daily_commute_km ?? ''), // NEW
        });
      } catch (e) {
        console.error('❌ Failed to load settings data', e);
        flash('❌ Failed to load settings');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const handleSetCurrentMonth = async () => {
    if (!currentMonthId) return flash('❌ Select a month first');
    try {
      await api.post('/settings/current_month', { month_id: Number(currentMonthId) });
      flash('✅ Current month updated');
    } catch (err) {
      console.error('❌ Error updating current month:', err);
      flash('❌ Error updating current month');
    }
  };

  const handleAccountChange = (index, field, value) => {
    setAccounts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const saveAccounts = async () => {
    try {
      await api.post('/settings/accounts', accounts);
      flash('✅ Accounts saved');
    } catch (err) {
      console.error('❌ Failed to save accounts:', err);
      flash('❌ Failed to save accounts');
    }
  };

  const savePrices = async () => {
    try {
      await api.post('/settings/prices', {
        el_price_ore_kwh: Number(prices.el_price_ore_kwh) || 0,
        bensin_price_sek_litre: Number(prices.bensin_price_sek_litre) || 0,
        diesel_price_sek_litre: Number(prices.diesel_price_sek_litre) || 0,
        yearly_km: Number(prices.yearly_km) || 0,
        daily_commute_km: Number(prices.daily_commute_km) || 0, // NEW
      });
      flash('✅ Prices saved');
    } catch (e) {
      console.error('❌ Failed to save prices', e);
      flash('❌ Failed to save prices');
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-3xl font-bold text-blue-600">⚙️ Settings</h1>

      {/* Current Month */}
      <div>
        <h2 className="text-xl font-semibold">Set Current Month</h2>
        <div className="flex items-center gap-2">
          <select
            value={currentMonthId}
            onChange={(e) => setCurrentMonthId(e.target.value)}
            className="border p-1 rounded min-w-56"
          >
            <option value="">-- Select Month --</option>
            {months.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleSetCurrentMonth}
            className="bg-blue-500 text-white px-3 py-1 rounded"
          >
            Save
          </button>
        </div>
      </div>

      {/* Energy, Fuel & Commute */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Energy, Fuel & Commute</h2>

        <div className="flex items-center gap-2">
          <label htmlFor="el_price_ore_kwh" className="w-56">Electricity Price (öre/kWh)</label>
          <input
            id="el_price_ore_kwh"
            type="number"
            className="border p-1 rounded w-40"
            value={prices.el_price_ore_kwh}
            onChange={(e) => setPrices((p) => ({ ...p, el_price_ore_kwh: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="bensin_price_sek_litre" className="w-56">Bensin (SEK/litre)</label>
          <input
            id="bensin_price_sek_litre"
            type="number"
            className="border p-1 rounded w-40"
            value={prices.bensin_price_sek_litre}
            onChange={(e) => setPrices((p) => ({ ...p, bensin_price_sek_litre: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="diesel_price_sek_litre" className="w-56">Diesel (SEK/litre)</label>
          <input
            id="diesel_price_sek_litre"
            type="number"
            className="border p-1 rounded w-40"
            value={prices.diesel_price_sek_litre}
            onChange={(e) => setPrices((p) => ({ ...p, diesel_price_sek_litre: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="yearly_km" className="w-56">Yearly driving (km)</label>
          <input
            id="yearly_km"
            type="number"
            className="border p-1 rounded w-40"
            value={prices.yearly_km}
            onChange={(e) => setPrices((p) => ({ ...p, yearly_km: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="daily_commute_km" className="w-56">Daily commute (km)</label>
          <input
            id="daily_commute_km"
            type="number"
            className="border p-1 rounded w-40"
            placeholder="e.g. 30"
            value={prices.daily_commute_km}
            onChange={(e) => setPrices((p) => ({ ...p, daily_commute_km: e.target.value }))}
          />
        </div>

        <button onClick={savePrices} className="bg-green-600 text-white px-3 py-1 rounded">
          Save
        </button>
      </div>

      {/* Accounts */}
      <div>
        <h2 className="text-xl font-semibold">Account Information</h2>
        {accounts.map((acc, index) => (
          <div key={acc.id ?? index} className="space-x-2 mb-2">
            <input
              type="text"
              value={acc.person}
              onChange={(e) => handleAccountChange(index, 'person', e.target.value)}
              placeholder="Person"
              className="border p-1"
            />
            <input
              type="text"
              value={acc.bank}
              onChange={(e) => handleAccountChange(index, 'bank', e.target.value)}
              placeholder="Bank"
              className="border p-1"
            />
            <input
              type="text"
              value={acc.acc_number}
              onChange={(e) => handleAccountChange(index, 'acc_number', e.target.value)}
              placeholder="Account Number"
              className="border p-1"
            />
            <input
              type="text"
              value={acc.country}
              onChange={(e) => handleAccountChange(index, 'country', e.target.value)}
              placeholder="Country"
              className="border p-1"
            />
          </div>
        ))}
        <button onClick={saveAccounts} className="bg-green-500 text-white px-3 py-1 rounded">
          Save Accounts
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}
    </div>
  );
}
