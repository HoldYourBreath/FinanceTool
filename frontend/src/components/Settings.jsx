// src/components/Settings.jsx
import { useEffect, useRef, useState } from "react";
import api from "../api/axios"; // ✅ make sure this import exists

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
  if (!ym || ym.length < 7) return "";
  const m = Number(ym.slice(5, 7));
  return Number.isFinite(m) ? String(m - 1) : "";
}

function normalizeAccInfo(payload) {
  const mapRow = (x, i) => ({
    id: x.id ?? i,
    person: x.person ?? "",
    bank: x.bank ?? "",
    acc_number: x.acc_number ?? "",
    country: x.country ?? "",
    value:
      x.value !== undefined && x.value !== null
        ? Number(x.value) || 0
        : Number(x.balance) || 0, // legacy compat
  });

  if (Array.isArray(payload)) return payload.map(mapRow);
  if (payload && typeof payload === "object") {
    for (const v of Object.values(payload)) {
      if (Array.isArray(v)) return v.map(mapRow);
    }
  }
  return [];
}

export default function Settings() {
  const [months] = useState(DEFAULT_MONTHS);
  const [currentMonthValue, setCurrentMonthValue] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [toast, setToast] = useState("");
  const didInit = useRef(false);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    // initialize month from localStorage
    const stored = localStorage.getItem("current_anchor");
    if (stored) {
      const v = ymToZeroBasedMonth(stored);
      if (v !== "") setCurrentMonthValue(v);
    }

    const controller = new AbortController();
    setAccountsLoading(true);

    (async () => {
      try {
        const res = await api.get("/acc_info", { signal: controller.signal });
        const rows = normalizeAccInfo(res.data);
        setAccounts(rows);
        window.__accDebug = { raw: res.data, rows }; // 🔎 debug in DevTools
        console.log("[Settings] /acc_info rows:", rows.length, rows);
      } catch (e) {
        if (!controller.signal.aborted) {
          console.error("❌ Failed to load accounts", e);
          flash("❌ Failed to load accounts");
          setAccounts([]);
        }
      } finally {
        if (!controller.signal.aborted) setAccountsLoading(false);
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
      controller.abort();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const handleSetCurrentMonth = async () => {
    if (currentMonthValue === "") return flash("❌ Select a month first");
    const monthIndex = Number(currentMonthValue);
    const year = new Date().getFullYear();
    const anchor = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

    try {
      localStorage.setItem("current_anchor", anchor);
      window.dispatchEvent(
        new CustomEvent("current-anchor-changed", { detail: anchor }),
      );

      await api.post(
        "/settings/current_month",
        { month_id: monthIndex },
        { headers: { "Content-Type": "application/json" } },
      );
      flash("✅ Current month updated");
    } catch (err) {
      console.error("❌ Error updating current month:", err);
      flash("❌ Error updating current month");
    }
  };

  const addRow = () => {
    setAccounts((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        person: "",
        bank: "",
        acc_number: "",
        country: "",
        value: 0,
      },
    ]);
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
            id="current-month"
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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Account Information</h2>
          {!accountsLoading && (
            <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">
              Loaded {accounts.length}
            </span>
          )}
        </div>

        <div className="mt-2 overflow-x-auto rounded border">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">Person</th>
                <th className="text-left p-2">Bank</th>
                <th className="text-left p-2">Account #</th>
                <th className="text-left p-2">Country</th>
                <th className="text-right p-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {accountsLoading ? (
                <tr>
                  <td colSpan={5} className="p-3 text-gray-500">
                    Loading accounts…
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-gray-500">
                    No accounts found (check Network →{" "}
                    <code>/api/acc_info</code>).
                  </td>
                </tr>
              ) : (
                accounts.map((acc, index) => (
                  <tr key={acc.id ?? index} className="border-t">
                    <td className="p-2">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={acc.person ?? ""}
                        onChange={(e) =>
                          handleAccountChange(index, "person", e.target.value)
                        }
                        placeholder="Person"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={acc.bank ?? ""}
                        onChange={(e) =>
                          handleAccountChange(index, "bank", e.target.value)
                        }
                        placeholder="Bank"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={acc.acc_number ?? ""}
                        onChange={(e) =>
                          handleAccountChange(
                            index,
                            "acc_number",
                            e.target.value,
                          )
                        }
                        placeholder="Account Number"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={acc.country ?? ""}
                        onChange={(e) =>
                          handleAccountChange(index, "country", e.target.value)
                        }
                        placeholder="Country"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        className="border rounded px-2 py-1 w-32 text-right"
                        value={acc.value ?? 0}
                        onChange={(e) =>
                          handleAccountChange(
                            index,
                            "value",
                            Number(e.target.value) || 0,
                          )
                        }
                        inputMode="numeric"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={addRow}
            className="bg-gray-200 px-3 py-1 rounded"
          >
            Add Row
          </button>
          <button
            type="button"
            data-testid="btn-save-accounts"
            onClick={saveAccounts}
            className="bg-green-500 text-white px-3 py-1 rounded"
          >
            Save Accounts
          </button>
        </div>
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
