// src/components/Settings.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Settings() {
  const [months, setMonths] = useState([]);
  const [currentMonthId, setCurrentMonthId] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [prices, setPrices] = useState({
    el_price_ore_kwh: 250,
    diesel_price_sek_litre: 15,
    bensin_price_sek_litre: 14,
    yearly_km: 18000,
    daily_commute_km: 30,
    downpayment_sek: 0,
    interest_rate_pct: 5,
  });
  const [toast, setToast] = useState("");

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  useEffect(() => {
    (async () => {
      try {
        // months
        const monthsRes = await api.get("/months/all");
        const ms = monthsRes.data || [];
        setMonths(ms);
        const current = ms.find((m) => m.is_current);
        if (current) setCurrentMonthId(String(current.id));
      } catch (e) {
        console.error("❌ Failed to load months", e);
        flash("❌ Failed to load months");
      }

      try {
        // accounts
        const accountsRes = await api.get("/acc_info");
        setAccounts(accountsRes.data || []);
      } catch (e) {
        console.error("❌ Failed to load accounts", e);
        flash("❌ Failed to load accounts");
      }

      try {
        // price settings (now includes downpayment_sek & interest_rate_pct)
        const priceRes = await api.get("/settings/prices");
        if (priceRes?.data && typeof priceRes.data === "object") {
          setPrices((prev) => ({ ...prev, ...priceRes.data }));
        }
      } catch (e) {
        console.error("❌ Failed to load price settings", e);
        // fall back to defaults already in state
      }
    })();
  }, []);

  const handleSetCurrentMonth = async () => {
    if (!currentMonthId) return flash("❌ Select a month first");
    try {
      await api.post("/settings/current_month", {
        month_id: Number(currentMonthId),
      });
      flash("✅ Current month updated");
    } catch (err) {
      console.error("❌ Error updating current month:", err);
      flash("❌ Error updating current month");
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
      await api.post("/settings/accounts", accounts);
      flash("✅ Accounts saved");
    } catch (err) {
      console.error("❌ Failed to save accounts:", err);
      flash("❌ Failed to save accounts");
    }
  };

  // PATCH just the changed field; update local state first for snappy UI
  const updatePrice = async (partial) => {
    setPrices((prev) => ({ ...prev, ...partial }));
    try {
      await api.patch("/settings/prices", partial);
      // no toast spam for every keystroke; only show on blur or after deliberate change if you want
    } catch (err) {
      console.error("❌ Failed to save prices:", err);
      flash("❌ Failed to save prices");
    }
  };

  return (
    <div data-testid="page-settings" className="space-y-6 p-4">
      {/* Energy, Fuel & Financing */}
      <section aria-label="Energy, Fuel & Financing" className="-mx-4 px-4 mb-3">
        <h2 className="text-xl font-semibold mb-2">Energy, Fuel &amp; Financing</h2>
        <div
          className="grid gap-4 items-end
                     grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
        >
          <Field
            id="el_price_ore_kwh"
            label="Electricity (öre/kWh)"
            value={num(prices.el_price_ore_kwh)}
            onChange={(v) => updatePrice({ el_price_ore_kwh: v })}
            min={0}
          />
          <Field
            id="bensin_price_sek_litre"
            label="Bensin (SEK/litre)"
            value={num(prices.bensin_price_sek_litre)}
            onChange={(v) => updatePrice({ bensin_price_sek_litre: v })}
            min={0}
            step="0.01"
          />
          <Field
            id="diesel_price_sek_litre"
            label="Diesel (SEK/litre)"
            value={num(prices.diesel_price_sek_litre)}
            onChange={(v) => updatePrice({ diesel_price_sek_litre: v })}
            min={0}
            step="0.01"
          />
          <Field
            id="yearly_km"
            label="Yearly driving (km)"
            value={num(prices.yearly_km)}
            onChange={(v) => updatePrice({ yearly_km: v })}
            min={0}
            step="1"
          />
          <Field
            id="daily_commute_km"
            label="Daily commute (km)"
            value={num(prices.daily_commute_km)}
            onChange={(v) => updatePrice({ daily_commute_km: v })}
            min={0}
            step="1"
          />
          <Field
            id="downpayment_sek"
            label="Downpayment (SEK)"
            value={num(prices.downpayment_sek)}
            onChange={(v) => updatePrice({ downpayment_sek: v })}
            min={0}
            step="1"
          />
          <Field
            id="interest_rate_pct"
            label="Interest rate (% / year)"
            value={num(prices.interest_rate_pct, 5)}
            onChange={(v) => updatePrice({ interest_rate_pct: v })}
            min={0}
            step="0.01"
          />
        </div>
      </section>

      {/* Current Month */}
      <div>
        <h2 className="text-xl font-semibold">Set Current Month</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="current-month" className="sr-only">
            Current Month
          </label>
          <select
            id="current-month"
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

      {/* Accounts */}
      <div>
        <h2 className="text-xl font-semibold">Account Information</h2>
        {accounts.map((acc, index) => {
          const pid = `person-${index}`;
          const bid = `bank-${index}`;
          const aid = `acc-number-${index}`;
          const cid = `country-${index}`;
          return (
            <div
              key={acc.id ?? index}
              className="space-x-2 mb-2 flex flex-wrap items-center gap-2"
            >
              <label htmlFor={pid} className="text-sm w-20">
                Person
              </label>
              <input
                id={pid}
                type="text"
                value={acc.person ?? ""}
                onChange={(e) =>
                  handleAccountChange(index, "person", e.target.value)
                }
                placeholder="Person"
                className="border p-1 rounded"
              />

              <label htmlFor={bid} className="text-sm w-14">
                Bank
              </label>
              <input
                id={bid}
                type="text"
                value={acc.bank ?? ""}
                onChange={(e) =>
                  handleAccountChange(index, "bank", e.target.value)
                }
                placeholder="Bank"
                className="border p-1 rounded"
              />

              <label htmlFor={aid} className="text-sm w-36">
                Account #
              </label>
              <input
                id={aid}
                type="text"
                value={acc.acc_number ?? ""}
                onChange={(e) =>
                  handleAccountChange(index, "acc_number", e.target.value)
                }
                placeholder="Account Number"
                className="border p-1 rounded"
              />

              <label htmlFor={cid} className="text-sm w-20">
                Country
              </label>
              <input
                id={cid}
                type="text"
                value={acc.country ?? ""}
                onChange={(e) =>
                  handleAccountChange(index, "country", e.target.value)
                }
                placeholder="Country"
                className="border p-1 rounded"
              />
            </div>
          );
        })}
        <button
          data-testid="btn-save-accounts"
          onClick={saveAccounts}
          className="bg-green-500 text-white px-3 py-1 rounded"
        >
          Save Accounts
        </button>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="toast"
          className="fixed bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded shadow"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// small helpers
const num = (v, fallback = 0) =>
  typeof v === "number" && !Number.isNaN(v) ? v : fallback;

function Field({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = "any",
}) {
  const labelCls = "block mb-1 text-[11px] font-medium text-slate-600";
  const inputCls =
    "h-9 w-full rounded-md border border-sky-200 bg-white/70 " +
    "px-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400";

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
        onChange={(e) => onChange(Number(e.target.value || 0))}
        onBlur={(e) => onChange(Number(e.target.value || 0))} // persist final value
      />
    </div>
  );
}
