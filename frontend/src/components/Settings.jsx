// src/components/Settings.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";

const DEFAULT_MONTHS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "6", label: "July" },
  { value: "5", label: "June" },
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
        : Number(x.balance) || 0,
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
  const [accounts, setAccounts] = useState(null); // null = not loaded yet
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  // Load saved month immediately
  useEffect(() => {
    const stored = localStorage.getItem("current_anchor");
    if (stored) {
      const v = ymToZeroBasedMonth(stored);
      if (v !== "") setCurrentMonthValue(v);
    }
    const onStorage = (e) => {
      if (e.key === "current_anchor" && e.newValue) {
        const v = ymToZeroBasedMonth(e.newValue);
        if (v !== "") setCurrentMonthValue(v);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Fetch accounts
  const refetch = () => {
    const controller = new AbortController();

    // Only show the big loader if we have no data yet
    setLoading((prev) => (accounts === null ? true : prev));
    setErr("");

    (async () => {
      try {
        const res = await api.get("/acc_info", { signal: controller.signal });
        const rows = normalizeAccInfo(res.data);
        setAccounts(rows);
        if (import.meta.env.DEV) {
          window.__accDebug = { raw: res.data, rows };
          console.log("[Settings] /acc_info rows:", rows.length, rows);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          console.error("❌ Failed to load accounts", e);
          setErr(
            e?.response
              ? `HTTP ${e.response.status} ${e.response.statusText}`
              : e?.message || "Network error",
          );
          // keep prior rows if we had any, otherwise set []
          setAccounts((prev) => (prev === null ? [] : prev));
          flash("❌ Failed to load accounts");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  };

  // Fetch on mount + refresh when regaining focus
  useEffect(() => {
    const abort = refetch();
    const onFocus = () => refetch();
    window.addEventListener("focus", onFocus);
    return () => {
      abort?.();
      window.removeEventListener("focus", onFocus);
    };
  }, []); // fresh mount each time you navigate back → runs again

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
    } catch (e) {
      console.error("❌ Error updating current month:", e);
      flash("❌ Error updating current month");
    }
  };

  const addRow = () => {
    setAccounts((prev) => [
      ...(prev || []),
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
      const base = Array.isArray(prev) ? prev : [];
      const next = [...base];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const saveAccounts = async () => {
    try {
      await api.post("/settings/accounts", accounts || [], {
        headers: { "Content-Type": "application/json" },
      });
      flash("✅ Accounts saved");
    } catch (e) {
      console.error("❌ Failed to save accounts:", e);
      flash("❌ Failed to save accounts");
    }
  };

  const hasRows = Array.isArray(accounts) && accounts.length > 0;

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
          {!err && accounts !== null && (
            <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">
              {loading && hasRows
                ? "Refreshing…"
                : `Accounts Loaded: ${accounts.length}`}
            </span>
          )}
        </div>

        {/* First-load loader */}
        {accounts === null && loading && (
          <div className="mt-2 text-gray-500">Loading accounts…</div>
        )}

        {/* Error on first load */}
        {err && accounts === null && !loading && (
          <div className="mt-2 text-red-600">
            Failed to load accounts ({err}). Check Network →{" "}
            <code>/api/acc_info</code>.
          </div>
        )}

        {/* Table (kept visible during refreshes) */}
        {accounts !== null && (
          <>
            {hasRows ? (
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
                    {accounts.map((acc, index) => (
                      <tr key={acc.id ?? index} className="border-t">
                        <td className="p-2">
                          <input
                            className="border rounded px-2 py-1 w-full"
                            value={acc.person ?? ""}
                            onChange={(e) =>
                              handleAccountChange(
                                index,
                                "person",
                                e.target.value,
                              )
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
                              handleAccountChange(
                                index,
                                "country",
                                e.target.value,
                              )
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
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-2 text-gray-500">
                No accounts found (check Network → <code>/api/acc_info</code>).
              </div>
            )}
          </>
        )}

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
