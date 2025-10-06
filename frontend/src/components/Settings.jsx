// src/components/Settings.jsx
import { useEffect, useRef, useState } from "react";
import api from "../api/axios";

const DEFAULT_MONTHS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

function ymToZeroBasedMonth(ym) {
  // ym: "YYYY-MM"
  if (!ym || ym.length < 7) return "";
  const m = Number(ym.slice(5, 7));
  return Number.isFinite(m) ? String(m - 1) : "";
}

export default function Settings() {
  const [months] = useState(DEFAULT_MONTHS);
  const [currentMonthValue, setCurrentMonthValue] = useState(""); // "0".."11"
  const [accounts, setAccounts] = useState([]);
  const [toast, setToast] = useState("");
  const loadedRef = useRef(false);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  // Initial load + cross-tab sync
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    // Initialize month select from localStorage anchor if present
    const stored = localStorage.getItem("current_anchor"); // "YYYY-MM"
    if (stored) {
      const v = ymToZeroBasedMonth(stored);
      if (v !== "") setCurrentMonthValue(v);
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/acc_info");
        if (!cancelled) setAccounts(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("❌ Failed to load accounts", e);
        if (!cancelled) flash("❌ Failed to load accounts");
      }
    })();

    const onStorage = (e) => {
      if (e.key === "current_anchor" && e.newValue) {
        const v = ymToZeroBasedMonth(e.newValue);
        if (v !== "") setCurrentMonthValue(v);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const handleSetCurrentMonth = async () => {
    if (currentMonthValue === "") return flash("❌ Select a month first");

    const monthIndex = Number(currentMonthValue); // 0..11
    const year = new Date().getFullYear();
    const anchor = `${year}-${String(monthIndex + 1).padStart(2, "0")}`; // "YYYY-MM"

    try {
      // Save locally and notify app
      localStorage.setItem("current_anchor", anchor);
      window.dispatchEvent(
        new CustomEvent("current-anchor-changed", { detail: anchor }),
      );

      // Server persist EXACTLY what the test expects:
      // POST JSON with { month_id: Number(currentMonthValue) }
      await api.post(
        "/settings/current_month",
        { month_id: Number(currentMonthValue) },
        { headers: { "Content-Type": "application/json" } },
      );

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
      await api.post("/settings/accounts", accounts, {
        headers: { "Content-Type": "application/json" },
      });
      flash("✅ Accounts saved");
    } catch (err) {
      console.error("❌ Failed to save accounts:", err);
      flash("❌ Failed to save accounts");
    }
  };

  return (
    <div data-testid="page-settings" className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold mb-2">Settings</h1>

      {/* Current Month */}
      <div>
        <h2 className="text-xl font-semibold">Set Current Month</h2>
        <div className="flex items-center gap-2 mt-2">
          <label htmlFor="current-month" className="sr-only">
            Current Month
          </label>
          <select
            id="current-month" // Playwright depends on this exact id
            value={currentMonthValue}
            onChange={(e) => setCurrentMonthValue(e.target.value)}
            className="border p-1 rounded min-w-56"
          >
            <option value="">-- Select Month --</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="button"
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
        <div className="mt-2">
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
        </div>
        <button
          type="button"
          data-testid="btn-save-accounts"
          onClick={saveAccounts}
          className="bg-green-500 text-white px-3 py-1 rounded"
        >
          Save Accounts
        </button>
      </div>

      {/* Toast */}
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
