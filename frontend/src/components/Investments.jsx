import { useEffect, useState } from "react";
import api from "../api/axios";
import { fetchaccinfo, updateAccValue } from "../api/acc_info"; // ⟵ NEW import
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

  // re-fetch acc_info after successful CSV upload
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

  // local edit & save for credit balance
  const updateLocalCredit = (id, value) => {
    setAccInfo((prev) =>
      prev.map((r) => (r.id === id ? { ...r, value } : r))
    );
  };

  const saveCredit = async (id, value) => {
    try {
      await updateAccValue(id, Number(value) || 0); // POST to backend
    } catch (e) {
      console.error("❌ Saving credit value failed:", e);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-8">
      {/* acc_info Financial Data */}
      <section>

        {/* stays on page; refresh after success */}
        <CsvUpload onUpdateacc_info={refreshAccInfo} />

        {accInfo.length === 0 ? (
          <div className="text-center text-red-600 mt-4">
            No acc_info data available.
          </div>
        ) : (
          <div className="space-y-2 mt-3">
            {accInfo.map((row) => {
              const credit = isCreditRow(row);
              return (
                <div
                  key={row.id ?? labelForAccount(row)}
                  className="flex justify-between items-center border-b pb-2"
                >
                  <span className="capitalize">{labelForAccount(row)}</span>

                  {credit ? (
                    <input
                      type="number"
                      step="0.01"
                      className="border p-1 rounded w-40 text-right"
                      value={row.value}
                      onChange={(e) => updateLocalCredit(row.id, e.target.value)}
                      onBlur={(e) => saveCredit(row.id, e.target.value)}
                    />
                  ) : (
                    <span className="font-bold">
                      {Number(row.value).toLocaleString("sv-SE")} SEK
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Investments */}
      <section>
        <h1 className="text-3xl font-bold mb-6 text-blue-700">💼 Investments</h1>
        {investments.length === 0 ? (
          <div className="text-center text-red-600">No investments available.</div>
        ) : (
          <div className="space-y-4">
            {investments.map((inv, index) => (
              <div
                key={inv.id || `investment-${index}`}
                className="p-4 bg-gray-100 rounded-xl border border-gray-300 hover:shadow-md transition-transform hover:scale-[1.02] space-y-4"
              >
                <h2 className="text-xl font-semibold">{inv.name}</h2>

                <div className="flex justify-between">
                  <span>Value:</span>
                  <span className="font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                    {Number(inv.value).toLocaleString("sv-SE")} SEK
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Paid:</span>
                  <span className="font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                    {Number(inv.paid).toLocaleString("sv-SE")} SEK
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Rent:</span>
                  <span className="font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
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
