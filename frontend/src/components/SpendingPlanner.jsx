import React, { useEffect, useState } from "react";

import api from "../api/axios";
import {
  fetchPlannedPurchases,
  deletePlannedPurchase,
  updatePlannedPurchase,
} from "../api/plannedPurchases";
import { fetchFinancing } from "../api/financing";

import FinanceChart from "./FinanceChart";

export default function SpendingPlanner() {
  const [monthsData, setMonthsData] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [financing, setFinancing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await api.get("/months");
        const sortedMonths = res.data.sort(
          (a, b) => new Date(a.name) - new Date(b.name),
        );
        setMonthsData(sortedMonths);

        const purchaseData = await fetchPlannedPurchases();
        setPurchases(Array.isArray(purchaseData) ? purchaseData : []);

        const financingData = await fetchFinancing();
        setFinancing(financingData);
      } catch (err) {
        console.error("❌ Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const isJune2025 = (monthName) => {
    return (
      monthName.startsWith("2025-06") ||
      (monthName.toLowerCase().includes("june") && monthName.includes("2025"))
    );
  };

  const getLoanRemaining = (monthName, fallback) => {
    if (isJune2025(monthName)) {
      const loan = financing.find((f) => f.name === "loans_taken");
      console.log(`📌 Checking loan for month: ${monthName}`);
      return loan ? Number(loan.value) : fallback;
    }
    return fallback;
  };

  const sumAmounts = (items) =>
    items.reduce((sum, item) => sum + Number(item.amount), 0);

  const chartData = monthsData.map((m) => {
    const income = sumAmounts(m.incomes);
    const expenses = sumAmounts(m.expenses);

    // Match planned purchases by month (yyyy-mm)
    const planned = purchases.filter((p) => {
      const purchaseDate = new Date(p.date);
      return (
        p.date &&
        m.name ===
          `${purchaseDate.getFullYear()}-${String(purchaseDate.getMonth() + 1).padStart(2, "0")}`
      );
    });

    const plannedSum = sumAmounts(planned);

    return {
      name: m.name,
      cash: m.endingFunds - plannedSum,
      loanRemaining: m.loanRemaining,
      income,
      expenses: expenses + plannedSum,
      surplus: income - (expenses + plannedSum),
    };
  });

  const total = purchases.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const filteredPurchases = purchases
    .filter((p) => p.item.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      if (a.date && b.date) return new Date(a.date) - new Date(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    });

  if (loading) return <div className="text-center p-4">Loading data...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">
      <h1 className="text-3xl font-bold mb-4 text-blue-600">
        📊 Spending Planner
      </h1>

      <FinanceChart data={chartData} />

      <table className="min-w-full table-auto border-collapse border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border border-gray-300 p-2 text-left">Item</th>
            <th className="border border-gray-300 p-2 text-right">
              Amount (SEK)
            </th>
            <th className="border border-gray-300 p-2 text-center">Date</th>
          </tr>
        </thead>
        <tbody>
          {filteredPurchases.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50 group">
              <td className="border border-gray-300 p-2 flex justify-between items-center">
                <input
                  value={p.item}
                  onChange={(e) =>
                    handleEditChange(p.id, "item", e.target.value)
                  }
                  className="border p-1 rounded w-full"
                />
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-2">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
              </td>
              <td className="border border-gray-300 p-2 text-right">
                <input
                  type="number"
                  value={p.amount}
                  onChange={(e) =>
                    handleEditChange(p.id, "amount", e.target.value)
                  }
                  className="border p-1 rounded text-right w-full"
                />
              </td>
              <td className="border border-gray-300 p-2 text-center">
                <input
                  type="date"
                  value={
                    p.date ? new Date(p.date).toISOString().split("T")[0] : ""
                  }
                  onChange={(e) =>
                    handleEditChange(p.id, "date", e.target.value)
                  }
                  className="border p-1 rounded"
                />
              </td>
            </tr>
          ))}
          <tr className="font-bold bg-gray-100">
            <td className="border border-gray-300 p-2">Total</td>
            <td className="border border-gray-300 p-2 text-right">{total}</td>
            <td className="border border-gray-300 p-2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
