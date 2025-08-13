import React, { useEffect, useState } from 'react';
import api from '../api/axios';

export default function PastMonths() {
  const [monthsData, setMonthsData] = useState([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchPastMonths() {
    try {
      const res = await api.get('/months/all');
      const months = res.data;

      // ✅ Ensure proper date sorting
      months.sort((a, b) => new Date(a.month_date) - new Date(b.month_date));

      console.log('First month object sample:', months[0]);
      months.forEach(m => console.log(m.name, m.month_date));

      // ✅ Find the index of the month marked as current
      const currentIndex = months.findIndex(m => m.is_current);
      console.log('Current Month Index:', currentIndex);

      // ✅ Slice months BEFORE the current one
      const pastMonths = currentIndex > 0 ? months.slice(0, currentIndex) : [];

      setMonthsData(pastMonths);


    } catch (err) {
      console.error('❌ Failed to fetch past months:', err);
    } finally {
      setLoading(false);
    }
  }
  fetchPastMonths();
}, []);


  if (loading) return <div className="text-center p-4">Loading Past Months...</div>;

  if (monthsData.length === 0) return <div className="text-center p-4 text-red-600">No Past Months Data Available.</div>;

  const sumAmounts = (items) => items.reduce((sum, item) => sum + Number(item.amount), 0);

  const categorize = (items, type) => {
    if (type === 'income') {
      return {
        'Janne Income': items.filter(i => i.name.includes('Janne') && !i.name.includes('Rent')),
        'Kristine Income': items.filter(i => i.name.includes('Kristine') && !i.name.includes('Rent')),
        'Rental Income': items.filter(i => i.name.includes('Rent')),
      };
    }
    return {
      'Food': items.filter(e => e.description.toLowerCase().includes('food')),
      'Housing': items.filter(e => e.description.toLowerCase().includes('rent') || e.description.toLowerCase().includes('loan')),
      'Transportation': items.filter(e => e.description.toLowerCase().includes('car') || e.description.toLowerCase().includes('transport')),
      'Phones': items.filter(e => e.description.toLowerCase().includes('phone')),
      'Subscriptions': items.filter(e => e.description.toLowerCase().includes('subscription')),
      'Union and Insurance': items.filter(e => e.description.toLowerCase().includes('union') || e.description.toLowerCase().includes('insurance')),
      'Other': items.filter(e =>
        !['food', 'rent', 'loan', 'car', 'transport', 'phone', 'subscription', 'union', 'insurance']
          .some(keyword => e.description.toLowerCase().includes(keyword))
      ),
    };
  };

  const categoryColors = {
    'Janne Income': 'text-green-700',
    'Kristine Income': 'text-blue-700',
    'Rental Income': 'text-orange-600',
    'Food': 'text-red-700',
    'Housing': 'text-green-700',
    'Transportation': 'text-orange-500',
    'Phones': 'text-blue-700',
    'Subscriptions': 'text-purple-700',
    'Union and Insurance': 'text-pink-700',
    'Other': 'text-gray-700',
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-blue-600">📅 Past Months</h1>

      {Array.from({ length: Math.ceil(monthsData.length / 4) }, (_, rowIndex) => {
        const rowMonths = monthsData.slice(rowIndex * 4, rowIndex * 4 + 4);
        return (
          <div key={rowIndex} className="flex flex-wrap gap-4 justify-center">
            {rowMonths.map((month) => {
              const totalIncome = sumAmounts(month.incomes);
              const totalExpenses = sumAmounts(month.expenses);
              const surplus = totalIncome - totalExpenses;

              const incomeCategories = categorize(month.incomes, 'income');
              const expenseCategories = categorize(month.expenses, 'expense');

              return (
                <div key={month.id} className="w-[320px] border p-4 rounded-lg shadow space-y-4 bg-white">
                  <h2 className="text-2xl font-bold text-blue-700">{month.name}</h2>

                  <div className={`text-center font-bold text-white py-2 rounded ${surplus >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                    {surplus >= 0 ? '+' : '-'} {Math.abs(surplus).toLocaleString()} SEK
                  </div>

                  <CategorySection title="💰 Income" categories={incomeCategories} total={totalIncome} categoryColors={categoryColors} />
                  <CategorySection title="💸 Expenses" categories={expenseCategories} total={totalExpenses} categoryColors={categoryColors} />

                  {month.loanAdjustments?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h3 className="text-lg font-semibold text-green-700">🧮 Loan Adjustments</h3>
                      {month.loanAdjustments.map((adj, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{adj.name}</span>
                          <span>{Number(adj.amount).toLocaleString('sv-SE')} SEK</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 border-t pt-2 text-sm text-gray-700 space-y-1">
                    <h3 className="text-base font-semibold">💰 Funds</h3>
                    <div className="flex justify-between"><span>Start:</span><span>{Number(month.startingFunds).toLocaleString('sv-SE')} SEK</span></div>
                    <div className="flex justify-between"><span>End:</span><span>{Number(month.endingFunds).toLocaleString('sv-SE')} SEK</span></div>
                    <div className="flex justify-between"><span>Loan Remaining:</span><span>{Number(month.loanRemaining || 0).toLocaleString('sv-SE')} SEK</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function CategorySection({ title, categories, total, categoryColors }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">{title} (Total {total.toLocaleString()} SEK)</h3>
      {Object.entries(categories).map(([category, items]) => (
        items.length > 0 && (
          <div key={category} className="mb-2">
            <div className={`font-bold ${categoryColors[category] || 'text-gray-700'}`}>
              {category} — {sumAmounts(items).toLocaleString()} SEK
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item.name || item.description}</span>
                <span>{Number(item.amount).toLocaleString()} SEK</span>
              </div>
            ))}
          </div>
        )
      ))}
    </div>
  );
}

function sumAmounts(items) {
  return items.reduce((sum, item) => sum + Number(item.amount), 0);
}
