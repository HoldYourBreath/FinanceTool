// src/components/Settings.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/axios";

export default function Settings() {
  const [months, setMonths] = useState([]);
  const [currentMonthId, setCurrentMonthId] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingMonth, setSavingMonth] = useState(false);
  const [savingAccounts, setSavingAccounts] = useState(false);
  const toastTimerRef = useRef(null);

  const flash = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Load months and accounts in parallel
        const [monthsRes, accountsRes] = await Promise.all([
          api.get("/months/all"),
          api.get("/acc_info"),
        ]);

        const ms = monthsRes.data || [];
        setMonths(ms);

        const current = ms.find((m) => m.is_current);
        if (current) setCurrentMonthId(String(current.id));

        setAccounts(accountsRes.data || []);
      } catch (e) {
        console.error("❌ Failed to load settings data", e);
        flash("❌ Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [flash]);

  const handleSetCurrentMonth = async () => {
    if (!currentMonthId) return flash("❌ Select a month first");
    try {
      setSavingMonth(true);
      await api.post("/settings/current_month", {
        month_id: Number(currentMonthId),
      });
      flash("✅ Current month updated");
    } catch (err) {
      console.error("❌ Error updating current month:", err);
      flash("❌ Error updating current month");
    } finally {
      setSavingMonth(false);
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
      setSavingAccounts(true);
      await api.post("/settings/accounts", accounts);
      flash("✅ Accounts saved");
    } catch (err) {
      console.error("❌ Failed to save accounts:", err);
      flash("❌ Failed to save accounts");
    } finally {
      setSavingAccounts(false);
    }
  };

  return (
    <div data-testid="page-settings" className="space-y-6 p-4">
      {/* Current Month */}
      <div>
        <h2 className="text-xl font-semibold">Set Current Month</h2>

        <div className="flex items-center gap-2 mt-2">
          <label htmlFor="current-month" className="sr-only">
            Current Month
          </label>

          <select
            id="current-month"
            value={currentMonthId}
            onChange={(e) => setCurrentMonthId(e.target.value)}
            className="border p-1 rounded min-w-56"
            disabled={loading || savingMonth}
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
            className="bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-60"
            disabled={loading || savingMonth || !currentMonthId}
            data-testid="btn-save-current-month"
            aria-busy={savingMonth ? "true" : "false"}
          >
            {savingMonth ? "Saving…" : "Save"}
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
                  disabled={loading || savingAccounts}
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
                  disabled={loading || savingAccounts}
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
                  disabled={loading || savingAccounts}
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
                  disabled={loading || savingAccounts}
                />
              </div>
            );
          })}
        </div>

        <button
          onClick={saveAccounts}
          className="bg-green-500 text-white px-3 py-1 rounded disabled:opacity-60"
          disabled={loading || savingAccounts}
          data-testid="btn-save-accounts"
          aria-busy={savingAccounts ? "true" : "false"}
        >
          {savingAccounts ? "Saving…" : "Save Accounts"}
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
