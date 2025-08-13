import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

export default function FinanceChart({ data }) {
  return (
    <div className="bg-purple-800 p-4 rounded-lg shadow text-white">
      <h2 className="text-center text-xl font-bold mb-4">📉 Finances During One Year</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 20, right: 40, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#aaa" />

          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            interval={0}
            height={80}
            tick={{ fontSize: 14, fill: '#fff' }}
          />

          <YAxis
            yAxisId="left"
            tick={{ fontSize: 14, fill: '#fff' }}
            tickFormatter={(v) => v.toLocaleString('sv-SE') + ' SEK'}
            width={90}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 14, fill: '#fff' }}
            tickFormatter={(v) => v.toLocaleString('sv-SE') + ' SEK'}
            width={90}
          />

          <Tooltip
            formatter={(value) => value.toLocaleString('sv-SE') + ' SEK'}
            labelStyle={{ fontWeight: 'bold' }}
            contentStyle={{ backgroundColor: '#333', borderColor: '#777', color: '#fff' }}
          />

          <Legend wrapperStyle={{ color: 'white' }} />

          <Line yAxisId="left" type="monotone" dataKey="cash" name="💵 Cash" stroke="limegreen" strokeWidth={2} />
          <Line yAxisId="right" type="monotone" dataKey="loanRemaining" name="🏦 Loan Remaining" stroke="red" strokeWidth={2} />
          <Line yAxisId="left" type="monotone" dataKey="income" name="📈 Income" stroke="cyan" strokeWidth={2} />
          <Line yAxisId="left" type="monotone" dataKey="expenses" name="📉 Expenses" stroke="hotpink" strokeWidth={2} />
          <Line yAxisId="left" type="monotone" dataKey="surplus" name="🧮 Cash Surplus/Deficit" stroke="gold" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
