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

        // Sort safely by date; fall back to `name` if `month_date` missing
        months.sort((a, b) => {
          const ta = new Date(a?.month_date ?? a?.name ?? 0).getTime() || 0;
          const tb = new Date(b?.month_date ?? b?.name ?? 0).getTime() || 0;
          return ta - tb;
        });

        // Find index of current month (accept true or "true")
        const currentIndex = months.findIndex(
          (m) =>
            m?.is_current === true ||
            String(m?.is_current).toLowerCase() === "true",
        );

        // If a current month exists, take strictly earlier ones; else keep all as "past"
        const pastMonths =
          currentIndex > -1 ? months.slice(0, currentIndex) : months;
        setMonthsData(pastMonths);
      } catch (err) {
        console.error("❌ Failed to fetch past months:", err);
        setMonthsData([]); // keep rendering stable
      } finally {
        setLoading(false);
      }
    }

    fetchPastMonths();
  }, []);

  // ---------- helpers ----------
  const sumAmounts = (items = []) =>
    items.reduce((sum, item) => sum + Number(item?.amount || 0), 0);

  const categorize = (items = [], type) => {
    if (type === "income") {
      return {
        "Janne Income": items.filter(
          (i) =>
            String(i?.name || "").includes("Janne") &&
            !String(i?.name || "").includes("Rent"),
        ),
        "Kristine Income": items.filter(
          (i) =>
            String(i?.name || "").includes("Kristine") &&
            !String(i?.name || "").includes("Rent"),
        ),
        "Rental Income": items.filter((i) =>
          String(i?.name || "").includes("Rent"),
        ),
      };
    }

    const toLower = (x) => String(x || "").toLowerCase();
    return {
      Food: items.filter((e) => toLower(e?.name).includes("food")),
      Housing: items.filter((e) => {
        const d = toLower(e?.name);
        return d.includes("rent") || d.includes("loan");
      }),
      Transportation: items.filter((e) => {
        const d = toLower(e?.name);
        return d.includes("car") || d.includes("transport");
      }),
      Phones: items.filter((e) => toLower(e?.name).includes("phone")),
      Subscriptions: items.filter((e) =>
        toLower(e?.name).includes("subscription"),
      ),
      "Union and Insurance": items.filter((e) => {
        const d = toLower(e?.name);
        return d.includes("union") || d.includes("insurance");
      }),
      Other: items.filter((e) => {
        const d = toLower(e?.name);
        return ![
          "food",
          "rent",
          "loan",
          "car",
          "transport",
          "phone",
          "subscription",
          "union",
          "insurance",
        ].some((k) => d.includes(k));
      }),
    };
  };

  // Hardcoded so Tailwind keeps the classes
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
                  const incomes = month?.incomes || [];
                  const expenses = month?.expenses || [];
                  const totalIncome = sumAmounts(incomes);
                  const totalExpenses = sumAmounts(expenses);
                  const surplus = totalIncome - totalExpenses;

                  const incomeCategories = categorize(incomes, "income");
                  const expenseCategories = categorize(expenses, "expense");

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
                        className={`text-center font-bold text-white py-2 rounded ${
                          surplus >= 0 ? "bg-green-500" : "bg-red-500"
                        }`}
                      >
                        {surplus >= 0 ? "+" : "-"}{" "}
                        {Math.abs(surplus).toLocaleString("sv-SE")} SEK
                      </div>

                      <CategorySection
                        title="💰 Income"
                        categories={incomeCategories}
                        total={totalIncome}
                        categoryColors={categoryColors}
                      />

                      <CategorySection
                        title="💸 Expenses"
                        categories={expenseCategories}
                        total={totalExpenses}
                        categoryColors={categoryColors}
                      />

                      {Array.isArray(month?.loanAdjustments) &&
                        month.loanAdjustments.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <h3 className="text-lg font-semibold text-green-700">
                              🧮 Loan Adjustments
                            </h3>
                            {month.loanAdjustments.map((adj, i2) => (
                              <div
                                key={i2}
                                className="flex justify-between text-sm"
                              >
                                <span>{adj?.name}</span>
                                <span>
                                  {Number(adj?.amount || 0).toLocaleString(
                                    "sv-SE",
                                  )}{" "}
                                  SEK
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                      <div className="mt-4 border-t pt-2 text-sm text-gray-700 space-y-1">
                        <h3 className="text-base font-semibold">💰 Funds</h3>
                        <div className="flex justify-between">
                          <span>Start:</span>
                          <span>
                            {Number(month?.startingFunds || 0).toLocaleString(
                              "sv-SE",
                            )}{" "}
                            SEK
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>End:</span>
                          <span>
                            {Number(month?.endingFunds || 0).toLocaleString(
                              "sv-SE",
                            )}{" "}
                            SEK
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Loan Remaining:</span>
                          <span>
                            {Number(month?.loanRemaining || 0).toLocaleString(
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
        )
      )}
    </div>
  );
}

// ---------- subcomponents ----------
function CategorySection({ title, categories, total, categoryColors }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">
        {title} (Total {Number(total || 0).toLocaleString("sv-SE")} SEK)
      </h3>
      {Object.entries(categories || {}).map(([category, items]) => {
        const list = items || [];
        if (!list.length) return null;

        const subtotal = list.reduce((s, it) => s + Number(it?.amount || 0), 0);
        const color = categoryColors?.[category] || "text-gray-700";

        return (
          <div key={category} className="mb-2">
            <div className={`font-bold ${color}`}>
              {category} — {subtotal.toLocaleString("sv-SE")} SEK
            </div>
            {list.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item?.name || item?.description || "Unnamed"}</span>
                <span>
                  {Number(item?.amount || 0).toLocaleString("sv-SE")} SEK
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
