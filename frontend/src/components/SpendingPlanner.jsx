// src/components/SpendingPlanner.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api/axios";
import FinanceChart from "./FinanceChart";
import {
  fetchPlannedPurchases,
  deletePlannedPurchase,
  updatePlannedPurchase,
} from "../api/plannedPurchases";

export default function SpendingPlanner() {
  const [monthsData, setMonthsData] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await api.get("/months");
        const sortedMonths = (res.data || []).sort(
          (a, b) => new Date(a.name) - new Date(b.name)
        );
        setMonthsData(sortedMonths);

        const purchaseData = await fetchPlannedPurchases();
        setPurchases(Array.isArray(purchaseData) ? purchaseData : []);
      } catch (err) {
        console.error("❌ Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const sumAmounts = useCallback(
    (items) => items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    []
  );

  const chartData = useMemo(() => {
    return monthsData.map((m) => {
      const income = sumAmounts(m.incomes || []);
      const expenses = sumAmounts(m.expenses || []);

      // Match planned purchases by month (yyyy-mm)
      const planned = purchases.filter((p) => {
        if (!p?.date) return false;
        const d = new Date(p.date);
        const monthKey = `${d.getFullYear()}-${String(
          d.getMonth() + 1
        ).padStart(2, "0")}`;
        return m.name === monthKey;
      });

      const plannedSum = sumAmounts(planned);

      return {
        name: m.name,
        cash: (m.endingFunds || 0) - plannedSum,
        loanRemaining: m.loanRemaining,
        income,
        expenses: expenses + plannedSum,
        surplus: income - (expenses + plannedSum),
      };
    });
  }, [monthsData, purchases, sumAmounts]);

  const filteredPurchases = useMemo(() => {
    const f = String(filter || "").toLowerCase();
    return [...purchases]
      .filter((p) => String(p.item || "").toLowerCase().includes(f))
      .sort((a, b) => {
        if (a.date && b.date) return new Date(a.date) - new Date(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return 0;
      });
  }, [purchases, filter]);

  const total = useMemo(
    () => purchases.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [purchases]
  );

  const handleEditChange = async (id, field, value) => {
    // optimistic UI update
    setPurchases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );

    try {
      const current = purchases.find((p) => p.id === id) || {};
      const next = { ...current, [field]: value };

      await updatePlannedPurchase(id, {
        item: next.item,
        amount: Number(next.amount) || 0,
        date: next.date || null,
      });
    } catch (err) {
      console.error("❌ Failed to update purchase", err);
      // best-effort re-fetch could be added if needed
    }
  };

  const handleDelete = async (id) => {
    const snapshot = purchases;
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    try {
      await deletePlannedPurchase(id);
    } catch (err) {
      console.error("❌ Failed to delete purchase", err);
      // rollback on error
      setPurchases(snapshot);
    }
  };

  const toInputDate = (d) => {
    if (!d) return "";
    const t = new Date(d);
    return Number.isNaN(t.getTime()) ? "" : t.toISOString().split("T")[0];
  };

  if (loading) return <div className="text-center p-4">Loading data...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">

      <FinanceChart data={chartData} />

      {/* Filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="purchase-filter" className="font-semibold">
          Filter purchases:
        </label>
        <input
          id="purchase-filter"
          className="border p-1 rounded w-64"
          placeholder="Type to filter by item name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <table className="min-w-full table-auto border-collapse border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border border-gray-300 p-2 text-left">Item</th>
            <th className="border border-gray-300 p-2 text-right">Amount (SEK)</th>
            <th className="border border-gray-300 p-2 text-center">Date</th>
          </tr>
        </thead>
        <tbody>
          {filteredPurchases.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50 group">
              <td className="border border-gray-300 p-2">
                <div className="flex justify-between items-center gap-2">
                  <input
                    value={p.item || ""}
                    onChange={(e) => handleEditChange(p.id, "item", e.target.value)}
                    className="border p-1 rounded w-full"
                  />
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </td>

              <td className="border border-gray-300 p-2 text-right">
                <input
                  type="number"
                  value={p.amount ?? ""}
                  onChange={(e) => handleEditChange(p.id, "amount", e.target.value)}
                  className="border p-1 rounded text-right w-full"
                />
              </td>

              <td className="border border-gray-300 p-2 text-center">
                <input
                  type="date"
                  value={toInputDate(p.date)}
                  onChange={(e) => handleEditChange(p.id, "date", e.target.value)}
                  className="border p-1 rounded"
                />
              </td>
            </tr>
          ))}

          <tr className="font-bold bg-gray-100">
            <td className="border border-gray-300 p-2">Total</td>
            <td className="border border-gray-300 p-2 text-right">
              {total.toLocaleString("sv-SE")}
            </td>
            <td className="border border-gray-300 p-2" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
