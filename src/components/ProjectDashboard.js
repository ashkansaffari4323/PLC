import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, LayoutDashboard, CheckCircle2, Clock, Lock, CircleDashed, UserCheck } from 'lucide-react';
import { gateService } from '../api/gateService';
import { summarizeGates, findCurrentGate, statusLabel } from '../utils/gateStatus';
import { syncAndSaveGates, getReviewerNames } from '../utils/reviewSync';
import StatusBadge from './ui/StatusBadge';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import GateStatusPie from './charts/GateStatusPie';
import PhaseCompletionBar from './charts/PhaseCompletionBar';
import PhaseGanttChart from './charts/PhaseGanttChart';
import GateGanttChart from './charts/GateGanttChart';

const StatCard = ({ icon: Icon, label, value, tone }) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-100 text-slate-500',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tones[tone]}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <div className="text-lg font-bold text-slate-900 leading-none">{value}</div>
        <div className="text-xs text-slate-400 mt-1">{label}</div>
      </div>
    </div>
  );
};

const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
    <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
    {children}
  </div>
);

const ProjectDashboard = ({ selectedProject }) => {
  const [gates, setGates] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!selectedProject?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [g, p] = await Promise.all([
        gateService.getGates(selectedProject.id),
        gateService.getPhases(selectedProject.id),
      ]);
      setGates(g);
      setPhases(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProject?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const syncLive = async () => {
    if (!selectedProject?.id) return;
    setSyncing(true);
    setError(null);
    try {
      const updated = await syncAndSaveGates(selectedProject.id, gates);
      setGates(updated);
    } catch (err) {
      setError(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (!selectedProject) {
    return (
      <div className="p-6">
        <EmptyState icon={LayoutDashboard} title="No project selected" description="Choose a project from the sidebar to see its lifecycle status." />
      </div>
    );
  }

  const sorted = [...gates].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const summary = summarizeGates(sorted);
  const current = findCurrentGate(sorted);
  const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  const anyReviewsAttached = sorted.some((g) => (g.criteria || []).some((c) => c.reviewId));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        icon={LayoutDashboard}
        title={selectedProject.name}
        subtitle={
          current
            ? `Currently open: ${current.name}`
            : summary.total > 0
            ? 'All gates resolved'
            : 'No gates configured yet'
        }
        actions={
          <>
            <button
              onClick={syncLive}
              disabled={syncing || !anyReviewsAttached}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync live status
            </button>
            <button onClick={load} disabled={loading} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm">
              <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-5">{error}</div>
      )}

      {summary.total > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard icon={CheckCircle2} label="Completed" value={summary.completed} tone="emerald" />
            <StatCard icon={Clock} label="In progress" value={summary.inProgress} tone="blue" />
            <StatCard icon={Lock} label="Locked" value={summary.locked} tone="slate" />
            <StatCard icon={CircleDashed} label="Pending" value={summary.pending} tone="amber" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 mb-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-slate-700">Overall progress</span>
              <span className="text-slate-400">{pct}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <ChartCard title="Gate status">
              <GateStatusPie summary={summary} />
            </ChartCard>
            <div className="lg:col-span-2">
              <ChartCard title="Completion by phase">
                <PhaseCompletionBar phases={phases} gates={sorted} />
              </ChartCard>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <ChartCard title="Phase timeline">
              <PhaseGanttChart phases={phases} gates={sorted} />
            </ChartCard>
            <ChartCard title="Gate timeline">
              <GateGanttChart gates={sorted} />
            </ChartCard>
          </div>
        </>
      )}

      <div className="space-y-2">
        {sorted.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
            <EmptyState icon={LayoutDashboard} title="No gates configured yet" description="Set them up in the Gates & Phases tab." />
          </div>
        )}
        {sorted.map((gate) => {
          const status = statusLabel(gate, sorted);
          const phase = phases.find((p) => p.id === gate.phaseId);
          const reviewerNames =
            status === 'in-progress'
              ? [...new Set((gate.criteria || []).filter((c) => c.reviewStatus === 'in-progress').flatMap((c) => getReviewerNames(c.nextActionBy)))]
              : [];
          return (
            <div key={gate.id} className="flex items-center justify-between bg-white border border-slate-200/70 shadow-sm rounded-xl px-4 py-3.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">{gate.name}</div>
                {phase && <div className="text-xs text-slate-400 mt-0.5">{phase.name}</div>}
                {reviewerNames.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-500 mt-1">
                    <UserCheck className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Waiting on: {reviewerNames.join(', ')}</span>
                  </div>
                )}
              </div>
              <StatusBadge status={status} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectDashboard;
