// src/components/PastMonths.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";

export default function PastMonths() {
  const [monthsData, setMonthsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPastMonths() {
      try {
        const res = await api.get("/months/all");
        const months = Array.isArray(res.data) ? [...res.data] : [];

        // Sort by month_date (fallback to name)
        months.sort((a, b) => {
          const ta = new Date(a?.month_date ?? a?.name ?? 0).getTime() || 0;
          const tb = new Date(b?.month_date ?? b?.name ?? 0).getTime() || 0;
          return ta - tb;
        });

        // Past months = strictly before the current one
        const currentIndex = months.findIndex(
          (m) =>
            m?.is_current === true ||
            String(m?.is_current).toLowerCase() === "true",
        );
        const past = currentIndex > -1 ? months.slice(0, currentIndex) : months;

        setMonthsData(past);
      } catch (err) {
        console.error("❌ Failed to fetch past months:", err);
        setMonthsData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPastMonths();
  }, []);

  // ---------- helpers ----------
  const formatSEK = (n) =>
    Number(n || 0).toLocaleString("sv-SE", {
      style: "currency",
      currency: "SEK",
      maximumFractionDigits: 0,
    });

  const sumAmounts = (items = []) =>
    items.reduce((sum, item) => sum + Number(item?.amount || 0), 0);

  const groupByCategory = (items = []) => {
    const map = {};
    for (const e of items) {
      const key = (e?.category || "Other").trim() || "Other";
      (map[key] ||= []).push(e);
    }
    return map;
  };

  // Hardcoded so Tailwind keeps the classes
  const expenseCategoryColors = {
    Housing: "text-green-700",
    Transportation: "text-orange-500",
    Food: "text-red-700",
    "Childcare and Family": "text-emerald-700",
    "Entertainment and Leisure": "text-indigo-700",
    Phones: "text-blue-700",
    Subscriptions: "text-purple-700",
    "Union and Insurance": "text-pink-700",
    Other: "text-gray-700",
  };

  // ---------- render ----------
  return (
    <div data-testid="page-past-months" className="space-y-8">
      {loading ? (
        <div className="text-center p-4">Loading Past Months...</div>
      ) : !Array.isArray(monthsData) || monthsData.length === 0 ? (
        <div className="text-center p-4 text-red-600">
          No Past Months Data Available.
        </div>
      ) : (
        Array.from(
          { length: Math.ceil(monthsData.length / 4) },
          (_, rowIndex) => {
            const rowMonths = monthsData.slice(rowIndex * 4, rowIndex * 4 + 4);
            return (
              <div
                key={rowIndex}
                className="flex flex-wrap gap-4 justify-center"
              >
                {rowMonths.map((month, idx) => {
                  const incomes = Array.isArray(month?.incomes)
                    ? month.incomes
                    : [];
                  const expenses = Array.isArray(month?.expenses)
                    ? month.expenses
                    : [];

                  const totalIncome = sumAmounts(incomes);
                  const totalExpenses = sumAmounts(expenses);
                  const surplus = totalIncome - totalExpenses;

                  const expenseGroups = groupByCategory(expenses);
                  const cardKey =
                    month?.id ?? `${month?.name || "month"}-${rowIndex}-${idx}`;

                  return (
                    <div
                      key={cardKey}
                      className="w-[320px] border p-4 rounded-lg shadow space-y-4 bg-white"
                    >
                      <h2 className="text-2xl font-bold text-blue-700">
                        {month?.name || "—"}
                      </h2>

                      <div
                        className={`text-center font-bold text-white py-2 rounded tabular-nums ${
                          surplus >= 0 ? "bg-green-500" : "bg-red-500"
                        }`}
                      >
                        {surplus >= 0 ? "+" : "-"}{" "}
                        {formatSEK(Math.abs(surplus))}
                      </div>

                      {/* Incomes: list each item + total */}
                      <IncomeSection
                        title="💰 Incomes"
                        items={incomes}
                        total={totalIncome}
                        formatSEK={formatSEK}
                        byPerson={month?.incomesByPerson || {}}
                      />

                      {/* Expenses grouped by server-provided category */}
                      <ExpenseSection
                        title="💸 Expenses"
                        groups={expenseGroups}
                        total={totalExpenses}
                        colors={expenseCategoryColors}
                        formatSEK={formatSEK}
                      />

                      {/* Loan adjustments (optional) */}
                      {Array.isArray(month?.loanAdjustments) &&
                        month.loanAdjustments.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <h3 className="text-lg font-semibold text-green-700">
                              🧮 Loan Adjustments
                            </h3>
                            {month.loanAdjustments.map((adj, i2) => (
                              <div
                                key={i2}
                                className="flex justify-between text-sm tabular-nums"
                              >
                                <span>{adj?.name}</span>
                                <span>{formatSEK(adj?.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                      {/* Funds */}
                      <div className="mt-4 border-t pt-2 text-sm text-gray-700 space-y-1">
                        <h3 className="text-base font-semibold">💰 Funds</h3>
                        <RowKV k="Start:" v={formatSEK(month?.startingFunds)} />
                        <RowKV k="End:" v={formatSEK(month?.endingFunds)} />
                        <RowKV
                          k="Loan Remaining:"
                          v={formatSEK(month?.loanRemaining)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          },
        )
      )}
    </div>
  );
}

// ---------- subcomponents ----------
function IncomeSection({ title, items, total, byPerson, formatSEK }) {
  const list = Array.isArray(items) ? items : [];
  const people = Object.entries(byPerson || {}).filter(
    ([p]) => (p || "").toLowerCase() !== "unknown",
  );

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">
        {title} (Total {formatSEK(total)})
      </h3>

      <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
        {list.map((i, idx) => (
          <li key={idx} className="flex justify-between tabular-nums">
            <span>
              • {i?.name || i?.source || "Unnamed"}
              {i?.person ? (
                <span className="ml-1 text-xs opacity-70">({i.person})</span>
              ) : null}
            </span>
            <span>+ {formatSEK(i?.amount)}</span>
          </li>
        ))}
        {list.length === 0 && (
          <li className="opacity-70">— No incomes recorded —</li>
        )}
      </ul>

      {people.length > 0 && (
        <div className="mt-1 text-xs text-muted-foreground">
          {people.map(([person, amt]) => (
            <div key={person} className="flex justify-between tabular-nums">
              <span>↳ {person}</span>
              <span>{formatSEK(amt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseSection({ title, groups, total, colors, formatSEK }) {
  const entries = Object.entries(groups || {});
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">
        {title} (Total {formatSEK(total)})
      </h3>

      {entries.length === 0 && (
        <div className="text-sm opacity-70">— No expenses recorded —</div>
      )}

      {entries.map(([category, list]) => {
        if (!list || list.length === 0) return null;
        const subtotal = list.reduce((s, it) => s + Number(it?.amount || 0), 0);
        const color = colors?.[category] || "text-gray-700";

        return (
          <div key={category} className="mb-2">
            <div className={`font-bold ${color}`}>
              {category} — {formatSEK(subtotal)}
            </div>
            {list.map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between text-sm tabular-nums"
              >
                <span>{item?.name || item?.description || "Unnamed"}</span>
                <span>{formatSEK(item?.amount)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function RowKV({ k, v }) {
  return (
    <div className="flex justify-between">
      <span>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
