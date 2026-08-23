import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { isGateCompleted, isGateLocked } from '../../utils/gateStatus';

const MAX_LABEL_CHARS = 18;

const renderPhaseTick = ({ x, y, payload }) => {
  const name = payload.value || '';
  const truncated = name.length > MAX_LABEL_CHARS ? `${name.slice(0, MAX_LABEL_CHARS - 1)}…` : name;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="#475569">
      <title>{name}</title>
      {truncated}
    </text>
  );
};

/** Horizontal bar chart: % of gates completed within each phase. Row height scales with phase count. */
const PhaseCompletionBar = ({ phases, gates }) => {
  const data = phases.map((phase) => {
    const phaseGates = gates.filter((g) => g.phaseId === phase.id);
    const total = phaseGates.length;
    const completed = phaseGates.filter((g) => isGateCompleted(g)).length;
    const anyLocked = phaseGates.some((g) => isGateLocked(g, gates));
    return {
      name: phase.name,
      pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      total,
      completed,
      color: total === 0 ? '#cbd5e1' : completed === total ? '#10b981' : anyLocked ? '#94a3b8' : '#3b82f6',
    };
  });

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">No phases yet</div>;
  }

  const chartHeight = Math.max(220, data.length * 34);
  const needsScroll = chartHeight > 360;

  const chart = (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={100} tick={renderPhaseTick} axisLine={false} tickLine={false} interval={0} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
          labelFormatter={(label) => label}
          formatter={(value, _name, props) => [`${props.payload.completed}/${props.payload.total} gates (${value}%)`, 'Complete']}
        />
        <Bar dataKey="pct" radius={[0, 6, 6, 0]} barSize={16}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  return needsScroll ? <div className="max-h-[360px] overflow-y-auto">{chart}</div> : chart;
};

export default PhaseCompletionBar;
