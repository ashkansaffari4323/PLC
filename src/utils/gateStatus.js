// src/utils/gateStatus.js
//
// Pure functions for interpreting gate state. A gate is a checkpoint in a
// phase; it's made of one or more "criteria", each optionally backed by an
// ACC review (criteria.reviewStatus gets set by syncing against the ACC
// Reviews API - see reviewService.js). Gates are ordered within a project;
// a gate can't open until the previous one (by `order`) is complete.

export function isCriterionSatisfied(criterion) {
  return criterion?.reviewStatus === 'approved';
}

export function isGateCompleted(gate) {
  const criteria = gate?.criteria || [];
  if (criteria.length === 0) return false;
  return criteria.every(isCriterionSatisfied);
}

export function isGateInProgress(gate) {
  if (isGateCompleted(gate)) return false;
  return (gate?.criteria || []).some((c) => c.reviewId || c.reviewStatus);
}

export function isGateLocked(gate, allGatesInProject) {
  if (!gate || gate.order === 0 || gate.order === undefined) return false;
  const previousGate = (allGatesInProject || []).find((g) => g.order === gate.order - 1);
  if (!previousGate) return false;
  return !isGateCompleted(previousGate);
}

export function summarizeGates(gates) {
  const list = gates || [];
  const summary = { total: list.length, completed: 0, inProgress: 0, locked: 0, pending: 0 };

  list.forEach((gate) => {
    if (isGateLocked(gate, list)) summary.locked += 1;
    else if (isGateCompleted(gate)) summary.completed += 1;
    else if (isGateInProgress(gate)) summary.inProgress += 1;
    else summary.pending += 1;
  });

  return summary;
}

/** The earliest unlocked, not-yet-complete gate - the one someone should work on next. */
export function findCurrentGate(gates) {
  const list = [...(gates || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return list.find((gate) => !isGateLocked(gate, list) && !isGateCompleted(gate)) || null;
}

export function statusLabel(gate, allGatesInProject) {
  if (isGateLocked(gate, allGatesInProject)) return 'locked';
  if (isGateCompleted(gate)) return 'completed';
  if (isGateInProgress(gate)) return 'in-progress';
  return 'pending';
}
