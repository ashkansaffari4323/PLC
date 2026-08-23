import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const DAY_MS = 1000 * 60 * 60 * 24;
const MAX_LABEL_CHARS = 18;

const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const renderTick = ({ x, y, payload }) => {
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
 * Generic Gantt-style timeline built on recharts' horizontal bar chart:
 * each item is one row with an invisible "offset" bar (days from the
 * earliest date in the set to this item's start) stacked behind a visible
 * "duration" bar - the standard way to fake a Gantt chart without a
 * dedicated charting library. Shared by the phase and gate timelines so
 * both stay visually and behaviorally identical.
 *
 * items: [{ id, name, startDate, finishDate }]
 * getColor: (item) => css color string
 */
const GanttChart = ({ items, getColor, emptyMessage }) => {
  const scheduled = items.filter((i) => i.startDate || i.finishDate);

  if (scheduled.length === 0) {
    return (
      <div className="flex items-center justify-center h-[160px] text-sm text-slate-400 text-center px-4">
        {emptyMessage}
      </div>
    );
  }

  const allDates = scheduled.flatMap((i) => [i.startDate, i.finishDate].filter(Boolean)).map((d) => new Date(d).getTime());
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const totalSpanDays = Math.max(1, Math.round((maxDate - minDate) / DAY_MS));

  const data = scheduled.map((item) => {
    const start = item.startDate ? new Date(item.startDate).getTime() : minDate;
    const finish = item.finishDate ? new Date(item.finishDate).getTime() : start + DAY_MS;
    const offsetDays = Math.round((start - minDate) / DAY_MS);
    const durationDays = Math.max(1, Math.round((finish - start) / DAY_MS));

    return {
      name: item.name,
      offset: offsetDays,
      duration: durationDays,
      color: getColor(item),
      startLabel: item.startDate ? fmt(item.startDate) : '—',
      finishLabel: item.finishDate ? fmt(item.finishDate) : '—',
    };
  });

  const chartHeight = Math.max(160, data.length * 26);
  const needsScroll = chartHeight > 280;

  const chart = (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis
          type="number"
          domain={[0, totalSpanDays]}
          tickFormatter={(v) => fmt(minDate + v * DAY_MS)}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis type="category" dataKey="name" width={100} tick={renderTick} axisLine={false} tickLine={false} interval={0} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
          labelFormatter={(label) => label}
          formatter={(value, name, props) =>
            name === 'duration' ? [`${props.payload.startLabel} - ${props.payload.finishLabel}`, 'Schedule'] : [null, null]
          }
        />
        <Bar dataKey="offset" stackId="a" fill="transparent" />
        <Bar dataKey="duration" stackId="a" radius={[5, 5, 5, 5]} barSize={12}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  return needsScroll ? <div className="max-h-[280px] overflow-y-auto">{chart}</div> : chart;
};

export default GanttChart;
