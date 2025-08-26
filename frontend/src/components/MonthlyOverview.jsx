// src/components/MonthlyOverview.jsx

import { useEffect, useState } from "react";

import api from "../api/axios";
import { fetchPlannedPurchases } from "../api/plannedPurchases";

import FinanceChart from "./FinanceChart";

// word-boundary matcher
const hasWord = (text, word) =>
  new RegExp(`(?:^|\\W)${word}(?:\\W|$)`, "i").test(String(text || ""));

// childcare keywords (EN + SV)
const isChildcare = (s) =>
  /\b(day ?care|child ?care|childcare|preschool|förskola|dagis|barnomsorg)\b/i.test(
    String(s || ""),
  );

export default function MonthlyOverview() {
  const [monthsData, setMonthsData] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await api.get("/months");
        const months = res.data;

        const currentIndex = months.findIndex((m) => m.is_current);
        const futureMonths =
          currentIndex >= 0 ? months.slice(currentIndex) : months;
        console.log("Fetched months:", months);
        console.log("Current Index:", currentIndex);

        setMonthsData(futureMonths);

        const purchaseData = await fetchPlannedPurchases();
        setPurchases(Array.isArray(purchaseData) ? purchaseData : []);
      } catch (err) {
        console.error("❌ Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  if (loading) {
    return <div className="text-center p-4">Loading Monthly Data...</div>;
  }

  if (!Array.isArray(monthsData) || monthsData.length === 0) {
    return (
      <div className="text-center p-4 text-red-600">
        No Monthly Data Available.
      </div>
    );
  }

  // infer a "person" label from backend field or the income name
const personFromIncome = (inc) => {
  // prefer backend-provided field if present
  const p = String(inc?.person ?? "").trim();
  if (p) return p;

  // otherwise, infer from the name (avoid treating "rent" as a person)
  const name = String(inc?.name || "");
  if (/\brent\b/i.test(name)) return null;

  // "<Name>'s ..." possessive
  const poss = name.match(/\b([A-ZÅÄÖ][\w\-’']+)'s\b/);
  if (poss) return poss[1];

  // first capitalized token heuristic
  const first = name.match(/^\s*([A-ZÅÄÖ][\w\-’']+)/);
  if (first) return first[1];

  return null;
};


  const categorizeIncome = (incomes) => {
  const byLabel = { "Rental Income": [] }; // fixed bucket for rent
  const totals = {}; // for optional sorting later

  incomes.forEach((inc) => {
    const name = String(inc?.name || "");
    if (/\brent\b/i.test(name)) {
      byLabel["Rental Income"].push(inc);
      return;
    }

    const person = personFromIncome(inc) || "Other"; // fallback bucket
    const label = `${person} Income`;
    if (!byLabel[label]) byLabel[label] = [];
    byLabel[label].push(inc);

    // track totals if you want to sort categories by size
    totals[label] = (totals[label] || 0) + Number(inc.amount || 0);
    });

    // Optional: sort categories by total descending (Rental last)
    const entries = Object.entries(byLabel).sort(([a], [b]) => {
      if (a === "Rental Income") return 1;
      if (b === "Rental Income") return -1;
      return (totals[b] || 0) - (totals[a] || 0);
    });

    // return back to object for existing render code
    return Object.fromEntries(entries);
  };


  const categorizeExpense = (expenses) => {
    const cats = {
      Food: [],
      Housing: [],
      Transportation: [],
      "Childcare and Family": [], // 👈 new category
      Phones: [],
      Subscriptions: [],
      "Union and Insurance": [],
      Other: [],
    };

    expenses.forEach((exp) => {
      const d = String(exp.description || "");

      if (isChildcare(d)) {
        cats["Childcare and Family"].push(exp);
      } else if (hasWord(d, "food")) {
        cats["Food"].push(exp);
      } else if (hasWord(d, "rent") || hasWord(d, "loan")) {
        cats["Housing"].push(exp);
      } else if (
        hasWord(d, "car") ||
        hasWord(d, "transport") ||
        hasWord(d, "diesel") ||
        hasWord(d, "fuel") ||
        hasWord(d, "parking") ||
        hasWord(d, "tire") ||
        hasWord(d, "tyre")
      ) {
        // word-boundary matching prevents \"daycare\" → Transportation
        cats["Transportation"].push(exp);
      } else if (hasWord(d, "phone")) {
        cats["Phones"].push(exp);
      } else if (hasWord(d, "subscription")) {
        cats["Subscriptions"].push(exp);
      } else if (hasWord(d, "union") || hasWord(d, "insurance")) {
        cats["Union and Insurance"].push(exp);
      } else {
        cats["Other"].push(exp);
      }
    });

    return cats;
  };

  const sumAmounts = (items) =>
    items.reduce((sum, item) => sum + Number(item.amount), 0);

  // ✅ Color mapping hardcoded to make Tailwind pick it up
  const categoryColors = {
    "Janne Income": "text-green-700",
    "Kristine Income": "text-blue-700",
    "Rental Income": "text-orange-600",
    Food: "text-red-700",
    Housing: "text-green-700",
    Transportation: "text-orange-500",
    Phones: "text-blue-700",
    Subscriptions: "text-purple-700",
    "Union and Insurance": "text-pink-700",
    Other: "text-gray-700",
  };

  const chartData = monthsData.map((m) => {
    const income = sumAmounts(m.incomes);
    const expenses = sumAmounts(m.expenses);

    // Match planned purchases by month (yyyy-mm)
    const planned = purchases.filter((p) => {
      if (!p.date) return false;
      const purchaseDate = new Date(p.date);
      return (
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

  return (
    <div className="space-y-8">
      <FinanceChart data={chartData} />
      {Array.from(
        { length: Math.ceil(monthsData.length / 4) },
        (_, rowIndex) => {
          const rowMonths = monthsData.slice(rowIndex * 4, rowIndex * 4 + 4);
          return (
            <div key={rowIndex} className="flex flex-wrap gap-4 justify-center">
              {rowMonths.map((month) => {
                const incomeCategories = categorizeIncome(month.incomes);
                const expenseCategories = categorizeExpense(month.expenses);

                const totalIncome = sumAmounts(month.incomes);
                const totalExpenses = sumAmounts(month.expenses);
                const surplus = totalIncome - totalExpenses;

                return (
                  <div
                    key={month.id}
                    className="w-[320px] border p-4 rounded-lg shadow space-y-4 bg-white"
                  >
                    <h2 className="text-2xl font-bold text-blue-700">
                      {month.name}
                    </h2>

                    <div
                      className={`text-center font-bold text-white py-2 rounded ${surplus >= 0 ? "bg-green-500" : "bg-red-500"}`}
                    >
                      {surplus >= 0 ? "+" : "-"}{" "}
                      {Math.abs(surplus).toLocaleString()} SEK
                    </div>

                    {/* Incomes Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        💰 Income (Total {totalIncome.toLocaleString()} SEK)
                      </h3>
                      {Object.entries(incomeCategories).map(
                        ([category, items]) => {
                          if (items.length === 0) return null;

                          const color =
                            categoryColors[category] || "text-gray-700";
                          const total = sumAmounts(items);

                          return (
                            <div key={category} className="mb-2">
                              <div className={`font-bold ${color}`}>
                                {category} — {total.toLocaleString()} SEK
                              </div>
                              {items.map((inc, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between text-sm"
                                >
                                  <span>{inc.name}</span>
                                  <span>
                                    {Number(inc.amount).toLocaleString()} SEK
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        },
                      )}
                    </div>

                    {/* Expenses Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        💸 Expenses (Total {totalExpenses.toLocaleString()} SEK)
                      </h3>
                      {Object.entries(expenseCategories).map(
                        ([category, items]) => {
                          if (items.length === 0) return null;

                          const color =
                            categoryColors[category] || "text-gray-700";
                          const total = sumAmounts(items);

                          return (
                            <div key={category} className="mb-2">
                              <div className={`font-bold ${color}`}>
                                {category} — {total.toLocaleString()} SEK
                              </div>
                              {items.map((exp, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between text-sm"
                                >
                                  <span>{exp.description}</span>
                                  <span>
                                    - {Number(exp.amount).toLocaleString()} SEK
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        },
                      )}
                    </div>

                    {/* Loan Adjustments Section */}
                    {month.loanAdjustments &&
                      month.loanAdjustments.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <h3 className="text-lg font-semibold text-green-700 flex items-center gap-2">
                            🧮 Loan Adjustments
                          </h3>
                          {month.loanAdjustments.map((adj, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between text-sm"
                            >
                              <span>{adj.name}</span>
                              <span className="font-semibold">
                                {Number(adj.amount).toLocaleString("sv-SE")} SEK
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    {/* Funds Section */}
                    <div className="mt-4 border-t pt-2 text-sm text-gray-700 space-y-1">
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        💰 Funds
                      </h3>
                      <div className="flex justify-between">
                        <span>Start:</span>
                        <span>
                          {Number(month.startingFunds).toLocaleString("sv-SE")}{" "}
                          SEK
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>End:</span>
                        <span>
                          {Number(month.endingFunds).toLocaleString("sv-SE")}{" "}
                          SEK
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Loan Remaining:</span>
                        <span>
                          {Number(month.loanRemaining || 0).toLocaleString(
                            "sv-SE",
                          )}{" "}
                          SEK
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        },
      )}
    </div>
  );
}
