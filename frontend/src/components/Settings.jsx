// src/components/Settings.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Settings() {
  const [months, setMonths] = useState([]);
  const [currentMonthId, setCurrentMonthId] = useState("");
  const [accounts, setAccounts] = useState([]);
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

  return (
    <div data-testid="page-settings" className="space-y-6 p-4">
      {/* Current Month */}
      <section>
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
      </section>

      {/* Accounts */}
      <section>
        <h2 className="text-xl font-semibold">Account Information</h2>
        <div className="mt-2 space-y-2">
          {accounts.map((acc, index) => {
            const pid = `person-${index}`;
            const bid = `bank-${index}`;
            const aid = `acc-number-${index}`;
            const cid = `country-${index}`;
            return (
              <div
                key={acc.id ?? index}
                className="space-x-2 flex flex-wrap items-center gap-2"
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
          data-testid="btn-save-accounts"
          onClick={saveAccounts}
          className="mt-2 bg-green-500 text-white px-3 py-1 rounded"
        >
          Save Accounts
        </button>
      </section>

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
