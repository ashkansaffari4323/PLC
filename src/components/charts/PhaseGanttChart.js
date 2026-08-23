import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { isGateCompleted, isGateLocked } from '../../utils/gateStatus';

const DAY_MS = 1000 * 60 * 60 * 24;
const MAX_LABEL_CHARS = 18;

const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

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

/**
 * Gantt-style timeline built on recharts' horizontal bar chart: each phase
 * is one row with an invisible "offset" bar (days from the project's
 * earliest date to this phase's start) stacked behind a visible "duration"
 * bar, which is the classic way to fake a Gantt chart without a dedicated
 * charting library. Phases with no dates set are listed separately since
 * they have nothing to place on the timeline. Row height scales with the
 * number of scheduled phases so labels never overlap.
 */
const PhaseGanttChart = ({ phases, gates }) => {
  const scheduled = phases.filter((p) => p.startDate || p.finishDate);
  const unscheduled = phases.filter((p) => !p.startDate && !p.finishDate);

  if (scheduled.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-slate-400 text-center px-4">
        No phase dates set yet - add start/finish dates in Gates & Phases to see a timeline.
      </div>
    );
  }

  const allDates = scheduled.flatMap((p) => [p.startDate, p.finishDate].filter(Boolean)).map((d) => new Date(d).getTime());
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const totalSpanDays = Math.max(1, Math.round((maxDate - minDate) / DAY_MS));

  const data = scheduled.map((phase) => {
    const start = phase.startDate ? new Date(phase.startDate).getTime() : minDate;
    const finish = phase.finishDate ? new Date(phase.finishDate).getTime() : start + DAY_MS;
    const offsetDays = Math.round((start - minDate) / DAY_MS);
    const durationDays = Math.max(1, Math.round((finish - start) / DAY_MS));

    const phaseGates = gates.filter((g) => g.phaseId === phase.id);
    const allComplete = phaseGates.length > 0 && phaseGates.every((g) => isGateCompleted(g));
    const anyLocked = phaseGates.some((g) => isGateLocked(g, gates));
    const color = phaseGates.length === 0 ? '#cbd5e1' : allComplete ? '#10b981' : anyLocked ? '#94a3b8' : '#3b82f6';

    return {
      name: phase.name,
      offset: offsetDays,
      duration: durationDays,
      color,
      startLabel: phase.startDate ? fmt(phase.startDate) : '—',
      finishLabel: phase.finishDate ? fmt(phase.finishDate) : '—',
    };
  });

  const chartHeight = Math.max(220, data.length * 34);
  const needsScroll = chartHeight > 360;

  const chart = (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis
          type="number"
          domain={[0, totalSpanDays]}
          tickFormatter={(v) => fmt(minDate + v * DAY_MS)}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis type="category" dataKey="name" width={100} tick={renderPhaseTick} axisLine={false} tickLine={false} interval={0} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
          labelFormatter={(label) => label}
          formatter={(value, name, props) =>
            name === 'duration' ? [`${props.payload.startLabel} - ${props.payload.finishLabel}`, 'Schedule'] : [null, null]
          }
        />
        <Bar dataKey="offset" stackId="a" fill="transparent" />
        <Bar dataKey="duration" stackId="a" radius={[6, 6, 6, 6]} barSize={16}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div>
      {needsScroll ? <div className="max-h-[360px] overflow-y-auto">{chart}</div> : chart}
      {unscheduled.length > 0 && (
        <p className="text-xs text-slate-400 mt-2 px-1">
          Not scheduled yet: {unscheduled.map((p) => p.name).join(', ')}
        </p>
      )}
    </div>
  );
};

export default PhaseGanttChart;
