import React from 'react';
import GanttChart from './GanttChart';
import { statusLabel } from '../../utils/gateStatus';

const STATUS_COLORS = {
  completed: '#10b981',
  'in-progress': '#3b82f6',
  locked: '#94a3b8',
  pending: '#f59e0b',
};

/** Gate timeline: colors each gate bar by its own current status. */
const GateGanttChart = ({ gates }) => {
  const getColor = (gate) => STATUS_COLORS[statusLabel(gate, gates)] || '#cbd5e1';

  return (
    <GanttChart
      items={gates}
      getColor={getColor}
      emptyMessage="No gate dates set yet - add start/finish dates in Gates & Phases to see a timeline."
    />
  );
};

export default GateGanttChart;
