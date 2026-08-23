import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = {
  Completed: '#10b981',
  'In progress': '#3b82f6',
  Locked: '#94a3b8',
  Pending: '#f59e0b',
};

/** Donut chart of gate status counts. Expects {completed, inProgress, locked, pending}. */
const GateStatusPie = ({ summary, height = 220 }) => {
  const data = [
    { name: 'Completed', value: summary.completed },
    { name: 'In progress', value: summary.inProgress },
    { name: 'Locked', value: summary.locked },
    { name: 'Pending', value: summary.pending },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-sm text-slate-400">No gates yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name]} stroke="white" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
          formatter={(value, name) => [value, name]}
        />
        <Legend
          verticalAlign="bottom"
          height={32}
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ fontSize: 12, color: '#475569' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default GateStatusPie;
