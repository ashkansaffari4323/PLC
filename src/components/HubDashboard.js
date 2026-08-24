import React, { useState, useEffect, useCallback } from 'react';
import { formatError } from '../api/client';
import {
  Building2, RefreshCw, AlertTriangle, Lock, FolderKanban,
  Search, ChevronDown, ChevronRight, UserCheck, FileText,
} from 'lucide-react';
import { hubService } from '../api/hubService';
import { gateService } from '../api/gateService';
import { summarizeGates, findCurrentGate } from '../utils/gateStatus';
import { syncAndSaveGates, getPendingReviewInfo } from '../utils/reviewSync';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import GateStatusPie from './charts/GateStatusPie';
import ProjectCompletionBar from './charts/ProjectCompletionBar';
import GanttChart from './charts/GanttChart';

const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
    <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
    {children}
  </div>
);

const Chip = ({ label, count, tone }) => {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    gray: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>
      {label}: {count}
    </span>
  );
};

const ProjectListRow = ({ project, gates, phases, expanded, onToggle }) => {
  const sorted = [...gates].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const summary = summarizeGates(sorted);
  const current = findCurrentGate(sorted);
  const currentPhase = current?.phaseId ? phases.find((p) => p.id === current.phaseId) : null;
  const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  const { reviewers, files } = getPendingReviewInfo(sorted);

  return (
    <div className="bg-white">
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-slate-50/70 transition-colors">
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate">{project.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {currentPhase ? currentPhase.name : summary.total === 0 ? 'Not configured yet' : '—'}
            {current && <> · Open gate: <span className="text-slate-500">{current.name}</span></>}
          </div>
        </div>

        {summary.total > 0 && (
          <div className="hidden sm:block w-28 flex-shrink-0">
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <span className="text-xs font-medium text-slate-400 w-10 text-right flex-shrink-0">
          {summary.total > 0 ? `${pct}%` : '—'}
        </span>

        {reviewers.length > 0 && (
          <span className="hidden md:inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full flex-shrink-0">
            <UserCheck className="h-3 w-3" /> {reviewers.length} reviewer{reviewers.length === 1 ? '' : 's'}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-12 space-y-3 border-t border-slate-50 pt-3">
          {summary.total > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip label="Completed" count={summary.completed} tone="green" />
              <Chip label="In progress" count={summary.inProgress} tone="blue" />
              <Chip label="Locked" count={summary.locked} tone="gray" />
              <Chip label="Pending" count={summary.pending} tone="amber" />
            </div>
          )}

          {summary.total === 0 ? (
            <p className="text-xs text-slate-400">No gates configured yet for this project.</p>
          ) : reviewers.length === 0 && files.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing waiting on a reviewer right now.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reviewers.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <UserCheck className="h-3 w-3" /> Next reviewers
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewers.map((name) => (
                      <span key={name} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{name}</span>
                    ))}
                  </div>
                </div>
              )}
              {files.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> Files needing review
                  </div>
                  <div className="space-y-1">
                    {files.map((name) => (
                      <div key={name} className="text-xs text-slate-600 truncate">{name}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {current && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {summary.locked === summary.total && summary.total > 0 ? (
                <><Lock className="h-3 w-3" /> All gates locked</>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const HubDashboard = ({ selectedHub }) => {
  const [projects, setProjects] = useState([]);
  const [projectData, setProjectData] = useState({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    if (!selectedHub?.id) return;
    setLoading(true);
    setError(null);
    try {
      const list = await hubService.getProjects(selectedHub.id);
      setProjects(list);
      const ids = list.map((p) => p.id).filter(Boolean);
      if (ids.length > 0) {
        setProjectData(await gateService.getHubGates(ids));
      } else {
        setProjectData({});
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedHub?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetches live ACC review status for every gate across every project in
  // the hub, sequentially, so a busy hub doesn't fire dozens of concurrent
  // requests at once. Persists each project's result as it goes, so a
  // partial failure part-way through still keeps earlier progress.
  const syncAllLive = async () => {
    setSyncing(true);
    setError(null);
    try {
      const updatedData = { ...projectData };
      for (const project of projects) {
        const entry = updatedData[project.id];
        if (!entry || !(entry.gates || []).some((g) => (g.criteria || []).some((c) => c.reviewId))) continue;
        const updatedGates = await syncAndSaveGates(project.id, entry.gates);
        updatedData[project.id] = { ...entry, gates: updatedGates };
      }
      setProjectData(updatedData);
    } catch (err) {
      setError(`Sync failed: ${formatError(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  if (!selectedHub) {
    return (
      <div className="p-6">
        <EmptyState icon={Building2} title="No hub selected" description="Choose a hub from the sidebar to see gate status across all its projects." />
      </div>
    );
  }

  const totals = projects.reduce(
    (acc, project) => {
      const data = projectData[project.id] || { gates: [] };
      const summary = summarizeGates(data.gates);
      acc.gates += summary.total;
      acc.completed += summary.completed;
      acc.inProgress += summary.inProgress;
      acc.locked += summary.locked;
      acc.pending += summary.pending;
      acc.withGates += summary.total > 0 ? 1 : 0;
      return acc;
    },
    { gates: 0, completed: 0, inProgress: 0, locked: 0, pending: 0, withGates: 0 }
  );

  const projectRows = projects
    .map((project) => {
      const data = projectData[project.id] || { gates: [] };
      const summary = summarizeGates(data.gates);
      return {
        name: project.name,
        total: summary.total,
        completed: summary.completed,
        pct: summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  // One timeline row per project: spans from the earliest scheduled
  // phase/gate date to the latest, across the whole project, colored by
  // overall completion. Projects with no dates set anywhere just don't
  // appear on the timeline (GanttChart lists them separately as
  // "not scheduled").
  const timelineItems = projects.map((project) => {
    const data = projectData[project.id] || { gates: [], phases: [] };
    const summary = summarizeGates(data.gates);
    const allDates = [...(data.gates || []), ...(data.phases || [])]
      .flatMap((item) => [item.startDate, item.finishDate])
      .filter(Boolean);
    return {
      id: project.id,
      name: project.name,
      startDate: allDates.length > 0 ? allDates.reduce((a, b) => (a < b ? a : b)) : null,
      finishDate: allDates.length > 0 ? allDates.reduce((a, b) => (a > b ? a : b)) : null,
      _summary: summary,
    };
  });

  const getTimelineColor = (item) => {
    if (item._summary.total === 0) return '#cbd5e1';
    if (item._summary.completed === item._summary.total) return '#10b981';
    if (item._summary.locked === item._summary.total) return '#94a3b8';
    return '#3b82f6';
  };

  const filteredProjects = projects.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6">
      <PageHeader
        icon={Building2}
        title={selectedHub.name || 'Hub'}
        subtitle={
          `${projects.length} project${projects.length === 1 ? '' : 's'}` +
          (totals.withGates > 0 ? ` · ${totals.withGates} with gates configured` : '') +
          (totals.gates > 0 ? ` · ${totals.completed}/${totals.gates} gates completed` : '')
        }
        actions={
          <>
            <button
              onClick={syncAllLive}
              disabled={syncing || totals.gates === 0}
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
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-5">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading && projects.length === 0 ? (
        <div className="text-sm text-slate-400">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
          <EmptyState icon={FolderKanban} title="No projects found" description="This hub doesn't have any projects yet." />
        </div>
      ) : (
        <>
          {totals.gates > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
              <ChartCard title="Gate status across the hub">
                <GateStatusPie summary={totals} />
              </ChartCard>
              <div className="lg:col-span-2">
                <ChartCard title="Completion by project">
                  <ProjectCompletionBar rows={projectRows} />
                </ChartCard>
              </div>
            </div>
          )}

          <div className="mb-5">
            <ChartCard title="Project timeline">
              <GanttChart
                items={timelineItems}
                getColor={getTimelineColor}
                emptyMessage="No phase or gate dates set anywhere in this hub yet - add them in a project's Gates & Phases tab to see a timeline here."
              />
            </ChartCard>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm divide-y divide-slate-50 overflow-hidden">
            {filteredProjects.length === 0 ? (
              <div className="p-1">
                <EmptyState icon={Search} title="No projects match your search" />
              </div>
            ) : (
              filteredProjects.map((project) => {
                const data = projectData[project.id] || { gates: [], phases: [] };
                return (
                  <ProjectListRow
                    key={project.id}
                    project={project}
                    gates={data.gates || []}
                    phases={data.phases || []}
                    expanded={expandedId === project.id}
                    onToggle={() => setExpandedId(expandedId === project.id ? null : project.id)}
                  />
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default HubDashboard;
