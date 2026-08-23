import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const MAX_LABEL_CHARS = 22;

/** Custom Y-axis tick that truncates long project names (full name shows via native title tooltip on hover). */
const renderProjectTick = ({ x, y, payload }) => {
  const name = payload.value || '';
  const truncated = name.length > MAX_LABEL_CHARS ? `${name.slice(0, MAX_LABEL_CHARS - 1)}…` : name;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="#475569">
      <title>{name}</title>
      {truncated}
    </text>
  );
};

/**
 * Horizontal bar chart comparing gate-completion % across every project in
 * a hub. Row height and total chart height scale with the number of
 * projects so labels never get squeezed into overlapping - past a point
 * the chart scrolls in its own container instead of shrinking further.
 */
const ProjectCompletionBar = ({ rows }) => {
  if (rows.length === 0) {
    return <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">No projects yet</div>;
  }

  const rowHeight = 34;
  const chartHeight = Math.max(220, rows.length * rowHeight);
  const needsScroll = chartHeight > 360;

  const chart = (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={150} tick={renderProjectTick} axisLine={false} tickLine={false} interval={0} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
          labelFormatter={(label) => label}
          formatter={(value, _name, props) =>
            props.payload.total > 0 ? [`${props.payload.completed}/${props.payload.total} gates (${value}%)`, 'Complete'] : ['No gates', '']
          }
        />
        <Bar dataKey="pct" radius={[0, 6, 6, 0]} barSize={16}>
          {rows.map((r) => (
            <Cell key={r.name} fill={r.total === 0 ? '#e2e8f0' : r.pct === 100 ? '#10b981' : '#3b82f6'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  return needsScroll ? <div className="max-h-[360px] overflow-y-auto">{chart}</div> : chart;
};

export default ProjectCompletionBar;
