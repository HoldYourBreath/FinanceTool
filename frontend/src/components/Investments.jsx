import { useEffect, useState } from "react";
import api from "../api/axios";
import { fetchaccinfo, updateAccValue } from "../api/acc_info";
import CsvUpload from "./CsvUpload";

export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [accInfo, setAccInfo] = useState([]);

  useEffect(() => {
    async function fetchInvestments() {
      try {
        const res = await api.get("/investments");
        setInvestments(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("❌ Failed to fetch investments:", err);
        setInvestments([]);
      }
    }
    async function loadAccInfo() {
      try {
        const data = await fetchaccinfo();
        setAccInfo(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("❌ Failed to fetch acc_info:", err);
        setAccInfo([]);
      }
    }
    fetchInvestments();
    loadAccInfo();
  }, []);

  const refreshAccInfo = async () => {
    try {
      const data = await fetchaccinfo();
      setAccInfo(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Failed to refresh acc_info:", err);
    }
  };

  const isCreditRow = (row) =>
    (row.acc_number || "").toLowerCase().startsWith("kredit");
  const labelForAccount = (a) => {
    const base = `${a.person} ${a.bank ?? ""} (${a.country ?? ""})`
      .trim()
      .replace(/\s+/g, " ");
    return isCreditRow(a) ? `${base} — Credit` : base;
  };

  const updateLocalCredit = (id, value) => {
    setAccInfo((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
  };
  const saveCredit = async (id, value) => {
    try {
      await updateAccValue(id, Number(value) || 0);
    } catch (e) {
      console.error("❌ Saving credit value failed:", e);
    }
  };

  // 🎨 Strong contrast vs. teal/emerald page background
  const inputCls =
    "rounded-lg border border-indigo-200 bg-white/85 px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-400";
  const cardIndigo =
    "rounded-2xl bg-indigo-50/90 ring-1 ring-indigo-200 p-4 shadow-sm backdrop-blur-sm";
  const cardAmber =
    "rounded-2xl bg-amber-50/90 ring-1 ring-amber-200 p-4 shadow-sm backdrop-blur-sm";
  const itemCard =
    "rounded-xl bg-white/90 ring-1 ring-amber-200 p-4 shadow-sm hover:shadow-md transition-transform hover:scale-[1.01] border-l-4 border-amber-300";

  return (
    <div className="space-y-6">
      {/* 📥 Accounts & Balances (indigo) */}
      <section className={cardIndigo}>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Accounts & Balances
        </h2>
        <CsvUpload onUpdateacc_info={refreshAccInfo} />
        {accInfo.length === 0 ? (
          <div className="text-center text-red-600 mt-4">
            No acc_info data available.
          </div>
        ) : (
          <div className="mt-3 divide-y divide-slate-200">
            {accInfo.map((row) => {
              const credit = isCreditRow(row);
              return (
                <div
                  key={row.id ?? labelForAccount(row)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2"
                >
                  <span className="capitalize text-slate-900">
                    {labelForAccount(row)}
                  </span>
                  {credit ? (
                    <input
                      type="number"
                      step="0.01"
                      className={`${inputCls} w-48 text-right`}
                      value={row.value}
                      onChange={(e) =>
                        updateLocalCredit(row.id, e.target.value)
                      }
                      onBlur={(e) => saveCredit(row.id, e.target.value)}
                    />
                  ) : (
                    <span className="font-bold text-indigo-800 bg-indigo-100/80 px-2 py-0.5 rounded">
                      {Number(row.value).toLocaleString("sv-SE")} SEK
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 💼 Investments (amber instead of red) */}
      <section className={cardAmber}>
        <h1 className="text-xl font-semibold mb-3 text-slate-900">
          💼 Investments
        </h1>
        {investments.length === 0 ? (
          <div className="text-center text-red-600">
            No investments available.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {investments.map((inv, index) => (
              <div key={inv.id || `investment-${index}`} className={itemCard}>
                <h2 className="text-base font-semibold text-slate-900 mb-2">
                  {inv.name}
                </h2>

                <div className="flex justify-between">
                  <span className="text-slate-700">Value:</span>
                  <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
                    {Number(inv.value).toLocaleString("sv-SE")} SEK
                  </span>
                </div>

                <div className="mt-1 flex justify-between">
                  <span className="text-slate-700">Paid:</span>
                  <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
                    {Number(inv.paid).toLocaleString("sv-SE")} SEK
                  </span>
                </div>

                <div className="mt-1 flex justify-between">
                  <span className="text-slate-700">Rent:</span>
                  <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
                    {Number(inv.rent).toLocaleString("sv-SE")} SEK
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
