// src/components/Investments.jsx
import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { updateAccValue } from "../api/acc_info";
import CsvUpload from "./CsvUpload";

export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [accInfo, setAccInfo] = useState([]);
  const didFetch = useRef(false); // stop StrictMode double fetch
  const prevCreditRef = useRef({}); // remember previous credit input

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    const controller = new AbortController();

    (async () => {
      try {
        const [invRes, accRes] = await Promise.all([
          api.get("/investments", { signal: controller.signal }),
          api.get("/acc_info", { signal: controller.signal }),
        ]);
        setInvestments(Array.isArray(invRes.data) ? invRes.data : []);
        setAccInfo(Array.isArray(accRes.data) ? accRes.data : []);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("❌ Initial load failed:", err);
          setInvestments([]);
          setAccInfo([]);
        }
      }
    })();

    return () => controller.abort();
  }, []);

  // Reusable loaders (CsvUpload uses this)
  async function loadAccInfo(signal) {
    try {
      const { data } = await api.get("/acc_info", { signal });
      setAccInfo(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!signal?.aborted) {
        console.error("❌ Failed to fetch acc_info:", err);
        setAccInfo([]);
      }
    }
  }
  const refreshAccInfo = () => loadAccInfo();

  // Helpers
  const isCreditRow = (row) =>
    (row.acc_number || "").toLowerCase().startsWith("kredit");

  const labelForAccount = (a) => {
    const person = (a.person ?? "").trim();
    const bank = (a.bank ?? "").trim();
    const country = (a.country ?? "").trim();
    const base = `${person} ${bank} ${country ? `(${country})` : ""}`
      .trim()
      .replace(/\s+/g, " ");
    return isCreditRow(a) ? `${base || "Account"} — Credit` : base || "Account";
  };

  const formatSEK = (v) => `${Number(v || 0).toLocaleString("sv-SE")} SEK`;

  const updateLocalCredit = (id, value) => {
    setAccInfo((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
  };

  async function saveCredit(id, value, prevValue) {
    try {
      await updateAccValue(id, Number(value) || 0);
    } catch (e) {
      console.error("❌ Saving credit value failed:", e);
      // revert on failure
      updateLocalCredit(id, prevValue);
      alert("Failed to save credit value");
    }
  }

  // 🎨 UI classes
  const inputCls =
    "rounded-lg border border-indigo-200 bg-white/85 px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-400";
  const cardIndigo =
    "rounded-2xl bg-indigo-50/90 ring-1 ring-indigo-200 p-4 shadow-sm backdrop-blur-sm";
  const cardAmber =
    "rounded-2xl bg-amber-50/90 ring-1 ring-amber-200 p-4 shadow-sm backdrop-blur-sm";
  const itemCard =
    "rounded-xl bg-white/90 ring-1 ring-amber-200 p-4 shadow-sm hover:shadow-md transition-transform hover:scale-[1.01] border-l-4 border-amber-300";

  return (
    <div data-testid="page-investments" className="space-y-6">
      {/* 📥 Accounts & Balances */}
      <section className={cardIndigo}>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Accounts & Balances
        </h2>

        {/* Keep prop name to match existing component contract */}
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
                      value={row.value ?? ""}
                      onFocus={() => {
                        prevCreditRef.current[row.id] = row.value ?? "";
                      }}
                      onChange={(e) =>
                        updateLocalCredit(row.id, e.target.value)
                      }
                      onBlur={(e) =>
                        saveCredit(
                          row.id,
                          e.target.value,
                          prevCreditRef.current[row.id],
                        )
                      }
                    />
                  ) : (
                    <span className="font-bold text-indigo-800 bg-indigo-100/80 px-2 py-0.5 rounded">
                      {formatSEK(row.value)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 💼 Investments */}
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
                    {formatSEK(inv.value)}
                  </span>
                </div>

                <div className="mt-1 flex justify-between">
                  <span className="text-slate-700">Paid:</span>
                  <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
                    {formatSEK(inv.paid)}
                  </span>
                </div>

                <div className="mt-1 flex justify-between">
                  <span className="text-slate-700">Rent:</span>
                  <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
                    {formatSEK(inv.rent)}
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
