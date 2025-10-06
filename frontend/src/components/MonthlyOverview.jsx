// src/components/MonthlyOverview.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { fetchPlannedPurchases } from "../api/plannedPurchases";
import FinanceChart from "./FinanceChart";

// ---------------- helpers ----------------
const hasWord = (text, word) =>
  new RegExp(`(?:^|\\W)${word}(?:\\W|$)`, "i").test(String(text || ""));

const isChildcare = (s) =>
  /\b(day ?care|child ?care|childcare|preschool|förskola|dagis|barnomsorg)\b/i.test(
    String(s || ""),
  );

const ym = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sumAmounts = (items) =>
  (items || []).reduce((s, it) => s + toNum(it?.amount), 0);

const personFromIncome = (inc) => {
  const p = String(inc?.person ?? "").trim();
  if (p) return p;

  const name = String(inc?.name || "");
  if (/\brent\b/i.test(name)) return null;

  const poss = name.match(/\b([A-ZÅÄÖ][\w\-’']+)'s\b/);
  if (poss) return poss[1];

  const first = name.match(/^\s*([A-ZÅÄÖ][\w\-’']+)/);
  if (first) return first[1];

  return null;
};

const categorizeIncome = (incomes) => {
  const byLabel = { "Rental Income": [] };
  const totals = {};

  (incomes || []).forEach((inc) => {
    const name = String(inc?.name || "");
    if (/\brent\b/i.test(name)) {
      byLabel["Rental Income"].push(inc);
      return;
    }
    const person = personFromIncome(inc) || "Other";
    const label = `${person} Income`;
    (byLabel[label] ||= []).push(inc);
    totals[label] = (totals[label] || 0) + toNum(inc?.amount);
  });

  const entries = Object.entries(byLabel).sort(([a], [b]) => {
    if (a === "Rental Income") return 1;
    if (b === "Rental Income") return -1;
    return (totals[b] || 0) - (totals[a] || 0);
  });

  return Object.fromEntries(entries);
};

const categorizeExpense = (expenses) => {
  const cats = {
    Food: [],
    Housing: [],
    Transportation: [],
    "Childcare and Family": [],
    Phones: [],
    Subscriptions: [],
    "Union and Insurance": [],
    Other: [],
  };

  (expenses || []).forEach((exp) => {
    const d = String(exp?.name || "");

    if (isChildcare(d)) {
      cats["Childcare and Family"].push(exp);
    } else if (hasWord(d, "food") || hasWord(d, "grocer")) {
      cats.Food.push(exp);
    } else if (
      hasWord(d, "rent") ||
      hasWord(d, "loan") ||
      hasWord(d, "mortgage")
    ) {
      cats.Housing.push(exp);
    } else if (
      hasWord(d, "car") ||
      hasWord(d, "transport") ||
      hasWord(d, "diesel") ||
      hasWord(d, "fuel") ||
      hasWord(d, "parking") ||
      hasWord(d, "tire") ||
      hasWord(d, "tyre")
    ) {
      cats.Transportation.push(exp);
    } else if (hasWord(d, "phone") || hasWord(d, "mobile")) {
      cats.Phones.push(exp);
    } else if (
      hasWord(d, "subscription") ||
      hasWord(d, "netflix") ||
      hasWord(d, "spotify")
    ) {
      cats.Subscriptions.push(exp);
    } else if (hasWord(d, "union") || hasWord(d, "insurance")) {
      cats["Union and Insurance"].push(exp);
    } else {
      cats.Other.push(exp);
    }
  });

  return cats;
};

// Tailwind color map (ensure every category has a class so purge keeps them)
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
  "Childcare and Family": "text-amber-700",
  Other: "text-gray-700",
};

// ---------------- component ----------------
export default function MonthlyOverview() {
  const [monthsData, setMonthsData] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Anchor from Settings (YYYY-MM). Fallback to today's month.
  const [anchor, setAnchor] = useState(
    localStorage.getItem("current_anchor") ||
      new Date().toISOString().slice(0, 7),
  );

  // React to Settings changes and cross-tab updates
  useEffect(() => {
    const onCustom = (e) => {
      const val = e?.detail || localStorage.getItem("current_anchor");
      if (val && val !== anchor) setAnchor(val);
    };
    const onStorage = (e) => {
      if (e.key === "current_anchor" && e.newValue && e.newValue !== anchor) {
        setAnchor(e.newValue);
      }
    };
    window.addEventListener("current-anchor-changed", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("current-anchor-changed", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [anchor]);

  // Load planned purchases once (doesn't depend on anchor)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchPlannedPurchases().catch(() => []);
        if (active) setPurchases(Array.isArray(data) ? data : []);
      } catch {
        if (active) setPurchases([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Load months whenever anchor changes
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/months", {
          params: { anchor }, // "YYYY-MM"
          signal: controller.signal,
        });

        const months = Array.isArray(res?.data) ? res.data : [];
        const currentIndex = months.findIndex((m) => m.is_current);
        const futureMonths =
          currentIndex >= 0 ? months.slice(currentIndex) : months;

        if (import.meta.env.DEV) {
          console.log("Fetched months:", months);
          console.log("Current Index:", currentIndex, "Anchor:", anchor);
        }

        if (active) setMonthsData(futureMonths);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("❌ Failed to fetch monthly data:", err);
          if (active) setMonthsData([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false; // prevent state updates after unmount
      controller.abort(); // cancel in-flight request
    };
  }, [anchor]);

  const chartData = useMemo(() => {
    if (!Array.isArray(monthsData) || monthsData.length === 0) return [];
    return monthsData.map((m) => {
      const income = sumAmounts(m.incomes);
      const expenses = sumAmounts(m.expenses);

      // Match planned purchases by YYYY-MM against m.month_date (YYYY-MM-DD)
      const plannedForMonth = (purchases || []).filter((p) => {
        if (!p?.date) return false;
        return (m?.month_date || "").slice(0, 7) === ym(new Date(p.date));
      });
      const plannedSum = sumAmounts(plannedForMonth);

      return {
        name: m.name,
        cash: toNum(m.endingFunds) - plannedSum,
        loanRemaining: toNum(m.loanRemaining),
        income,
        expenses: expenses + plannedSum,
        surplus: income - (expenses + plannedSum),
      };
    });
  }, [monthsData, purchases]);

  if (loading) {
    return (
      <div data-testid="page-home" className="text-center p-4">
        Loading Monthly Data...
      </div>
    );
  }

  if (!Array.isArray(monthsData) || monthsData.length === 0) {
    return (
      <div data-testid="page-home" className="text-center p-4 text-red-600">
        No Monthly Data Available.
      </div>
    );
  }

  return (
    <div data-testid="page-home" className="space-y-8">
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
                      className={`text-center font-bold text-white py-2 rounded ${
                        surplus >= 0 ? "bg-green-500" : "bg-red-500"
                      }`}
                    >
                      {surplus >= 0 ? "+" : "-"}{" "}
                      {Math.abs(surplus).toLocaleString("sv-SE")} SEK
                    </div>

                    {/* Incomes */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        💰 Income (Total {totalIncome.toLocaleString("sv-SE")}{" "}
                        SEK)
                      </h3>
                      {Object.entries(incomeCategories).map(
                        ([category, items]) => {
                          if (!items.length) return null;
                          const color =
                            categoryColors[category] || "text-gray-700";
                          const total = sumAmounts(items);
                          return (
                            <div key={category} className="mb-2">
                              <div className={`font-bold ${color}`}>
                                {category} — {total.toLocaleString("sv-SE")} SEK
                              </div>
                              {items.map((inc, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between text-sm"
                                >
                                  <span>{inc.name}</span>
                                  <span>
                                    {toNum(inc.amount).toLocaleString("sv-SE")}{" "}
                                    SEK
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        },
                      )}
                    </div>

                    {/* Expenses */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        💸 Expenses (Total{" "}
                        {totalExpenses.toLocaleString("sv-SE")} SEK)
                      </h3>
                      {Object.entries(expenseCategories).map(
                        ([category, items]) => {
                          if (!items.length) return null;
                          const color =
                            categoryColors[category] || "text-gray-700";
                          const total = sumAmounts(items);
                          return (
                            <div key={category} className="mb-2">
                              <div className={`font-bold ${color}`}>
                                {category} — {total.toLocaleString("sv-SE")} SEK
                              </div>
                              {items.map((exp, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between text-sm"
                                >
                                  <span>
                                    {exp?.name || exp?.description || "Unnamed"}
                                  </span>
                                  <span>
                                    -{" "}
                                    {toNum(exp.amount).toLocaleString("sv-SE")}{" "}
                                    SEK
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        },
                      )}
                    </div>

                    {/* Loan Adjustments */}
                    {Array.isArray(month.loanAdjustments) &&
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
                                {toNum(adj.amount).toLocaleString("sv-SE")} SEK
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    {/* Funds */}
                    <div className="mt-4 border-t pt-2 text-sm text-gray-700 space-y-1">
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        💰 Funds
                      </h3>
                      <div className="flex justify-between">
                        <span>Start:</span>
                        <span>
                          {toNum(month.startingFunds).toLocaleString("sv-SE")}{" "}
                          SEK
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>End:</span>
                        <span>
                          {toNum(month.endingFunds).toLocaleString("sv-SE")} SEK
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Loan Remaining:</span>
                        <span>
                          {toNum(month.loanRemaining).toLocaleString("sv-SE")}{" "}
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
