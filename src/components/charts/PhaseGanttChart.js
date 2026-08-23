import React from 'react';
import GanttChart from './GanttChart';
import { isGateCompleted, isGateLocked } from '../../utils/gateStatus';

/** Phase timeline: colors each phase bar by the aggregate status of its gates. */
const PhaseGanttChart = ({ phases, gates }) => {
  const getColor = (phase) => {
    const phaseGates = gates.filter((g) => g.phaseId === phase.id);
    if (phaseGates.length === 0) return '#cbd5e1';
    const allComplete = phaseGates.every((g) => isGateCompleted(g));
    if (allComplete) return '#10b981';
    const anyLocked = phaseGates.some((g) => isGateLocked(g, gates));
    return anyLocked ? '#94a3b8' : '#3b82f6';
  };

  return (
    <GanttChart
      items={phases}
      getColor={getColor}
      emptyMessage="No phase dates set yet - add start/finish dates in Gates & Phases to see a timeline."
    />
  );
};

export default PhaseGanttChart;
