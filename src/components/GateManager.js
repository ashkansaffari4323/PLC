import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, RefreshCw, Send, Trash2, ChevronDown, ChevronRight,
  FileText, ShieldCheck, Layers, RotateCcw, History, Pencil, Calendar, Check, X, UserCheck,
} from 'lucide-react';
import { gateService } from '../api/gateService';
import { reviewService } from '../api/reviewService';
import { isGateLocked, isGateCompleted, statusLabel } from '../utils/gateStatus';
import { extractReviewInfo, syncAndSaveGates, getReviewerNames } from '../utils/reviewSync';
import SendReviewModal from './SendReviewModal';
import StatusBadge from './ui/StatusBadge';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';

const CriterionStatusBadge = ({ status }) => {
  if (!status) return <span className="text-xs text-slate-300">Not sent yet</span>;
  const mapped = status === 'approved' ? 'completed' : status === 'rejected' ? 'rejected' : 'in-progress';
  return <StatusBadge status={mapped} />;
};

const GateManager = ({ selectedHub, selectedProject }) => {
  const [phases, setPhases] = useState([]);
  const [gates, setGates] = useState([]);
  const [expandedGateId, setExpandedGateId] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const [newPhaseName, setNewPhaseName] = useState('');
  const [newPhaseStart, setNewPhaseStart] = useState('');
  const [newPhaseFinish, setNewPhaseFinish] = useState('');
  const [editingPhaseId, setEditingPhaseId] = useState(null);
  const [editPhaseDraft, setEditPhaseDraft] = useState({ name: '', startDate: '', finishDate: '' });
  const [newGateName, setNewGateName] = useState('');
  const [newGatePhaseId, setNewGatePhaseId] = useState('');
  const [criterionDraft, setCriterionDraft] = useState({});
  const [reviewModalTarget, setReviewModalTarget] = useState(null); // { gateId, criterionId }

  const projectId = selectedProject?.id;

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [loadedPhases, loadedGates, loadedWorkflows] = await Promise.all([
        gateService.getPhases(projectId),
        gateService.getGates(projectId),
        reviewService.getWorkflows(projectId).catch(() => []),
      ]);
      setPhases(loadedPhases);
      setGates(loadedGates);
      setWorkflows(loadedWorkflows);
      if (loadedPhases.length > 0 && !newGatePhaseId) {
        setNewGatePhaseId(loadedPhases[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const persistGates = async (updated) => {
    setGates(updated);
    try {
      await gateService.saveGates(projectId, updated);
    } catch (err) {
      setError(`Failed to save gates: ${err.message}`);
    }
  };

  const persistPhases = async (updated) => {
    setPhases(updated);
    try {
      await gateService.savePhases(projectId, updated);
    } catch (err) {
      setError(`Failed to save phases: ${err.message}`);
    }
  };

  const addPhase = () => {
    if (!newPhaseName.trim()) return;
    persistPhases([
      ...phases,
      {
        id: `phase-${Date.now()}`,
        name: newPhaseName.trim(),
        order: phases.length,
        startDate: newPhaseStart || null,
        finishDate: newPhaseFinish || null,
      },
    ]);
    setNewPhaseName('');
    setNewPhaseStart('');
    setNewPhaseFinish('');
  };

  const startEditPhase = (phase) => {
    setEditingPhaseId(phase.id);
    setEditPhaseDraft({ name: phase.name, startDate: phase.startDate || '', finishDate: phase.finishDate || '' });
  };

  const saveEditPhase = () => {
    if (!editPhaseDraft.name.trim()) return;
    persistPhases(
      phases.map((p) =>
        p.id === editingPhaseId
          ? { ...p, name: editPhaseDraft.name.trim(), startDate: editPhaseDraft.startDate || null, finishDate: editPhaseDraft.finishDate || null }
          : p
      )
    );
    setEditingPhaseId(null);
  };

  const deletePhase = (phaseId) => {
    if (!window.confirm('Delete this phase? Gates assigned to it will become unassigned, not deleted.')) return;
    persistPhases(phases.filter((p) => p.id !== phaseId));
    // Gates that pointed at this phase shouldn't silently keep a dangling
    // reference - unassign them rather than deleting the gates themselves.
    persistGates(gates.map((g) => (g.phaseId === phaseId ? { ...g, phaseId: null } : g)));
  };

  const formatDateRange = (phase) => {
    if (!phase.startDate && !phase.finishDate) return null;
    const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    if (phase.startDate && phase.finishDate) return `${fmt(phase.startDate)} - ${fmt(phase.finishDate)}`;
    if (phase.startDate) return `From ${fmt(phase.startDate)}`;
    return `Due ${fmt(phase.finishDate)}`;
  };

  const addGate = () => {
    if (!newGateName.trim() || !newGatePhaseId) return;
    persistGates([
      ...gates,
      { id: `gate-${Date.now()}`, name: newGateName.trim(), phaseId: newGatePhaseId, order: gates.length, criteria: [] },
    ]);
    setNewGateName('');
  };

  const deleteGate = (gateId) => persistGates(gates.filter((g) => g.id !== gateId));

  const addCriterion = (gateId) => {
    const text = (criterionDraft[gateId] || '').trim();
    if (!text) return;
    persistGates(
      gates.map((g) =>
        g.id === gateId
          ? { ...g, criteria: [...(g.criteria || []), { id: `crit-${Date.now()}`, description: text, reviewStatus: null, submissions: [] }] }
          : g
      )
    );
    setCriterionDraft((prev) => ({ ...prev, [gateId]: '' }));
  };

  const removeCriterion = (gateId, criterionId) =>
    persistGates(gates.map((g) => (g.id === gateId ? { ...g, criteria: g.criteria.filter((c) => c.id !== criterionId) } : g)));

  // Sending (or resending, after a rejection) for review: creates one ACC
  // review covering every selected document, fetches its real status right
  // away, and records the whole thing as a new entry in the criterion's
  // submission history. The most recent submission's status is what
  // actually drives whether the gate is locked/unlocked - see
  // utils/gateStatus.js - so a fresh approval always overrides a prior
  // rejection.
  const handleSendForReview = async (workflowId, files, name) => {
    const { gateId, criterionId } = reviewModalTarget;
    const workflow = workflows.find((w) => w.id === workflowId);

    // The 201 response from creating a review already includes status and
    // nextActionBy - no need for a separate fetch right after creating it.
    const review = await reviewService.createReview(projectId, {
      name,
      workflowId,
      fileVersions: files.map((f) => ({ urn: f.versionId })),
    });
    const reviewId = review?.id;
    const info = extractReviewInfo(review);

    const submission = {
      id: `sub-${Date.now()}`,
      workflowId,
      workflowName: workflow?.name || workflowId,
      documents: files,
      reviewId,
      reviewStatus: info.status,
      nextActionBy: info.nextActionBy,
      createdAt: new Date().toISOString(),
    };

    const updated = gates.map((g) =>
      g.id === gateId
        ? {
            ...g,
            criteria: g.criteria.map((c) =>
              c.id === criterionId
                ? {
                    ...c,
                    submissions: [...(c.submissions || []), submission],
                    reviewId: submission.reviewId,
                    reviewStatus: submission.reviewStatus,
                    nextActionBy: submission.nextActionBy,
                    documentName: files.map((f) => f.name).join(', '),
                  }
                : c
            ),
          }
        : g
    );
    await persistGates(updated);
    setReviewModalTarget(null);
  };

  const syncAll = async () => {
    setSyncing(true);
    setError(null);
    try {
      const updated = await syncAndSaveGates(projectId, gates);
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
        <EmptyState icon={ShieldCheck} title="No project selected" description="Choose a project from the sidebar to manage its phases and gates." />
      </div>
    );
  }

  const sortedGates = [...gates].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const anyReviewsAttached = sortedGates.some((g) => (g.criteria || []).some((c) => c.reviewId));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        icon={ShieldCheck}
        title="Gates & Phases"
        subtitle={selectedProject.name}
        actions={
          <button
            onClick={syncAll}
            disabled={syncing || !anyReviewsAttached}
            title={anyReviewsAttached ? 'Fetch the latest ACC review status for every gate' : 'No reviews sent yet'}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync live status
          </button>
        }
      />

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-5">{error}</div>
      )}

      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3.5">
            <Layers className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-900">Phases</h3>
          </div>

          <div className="space-y-2 mb-4">
            {phases.map((p) => {
              const editing = editingPhaseId === p.id;
              const dateRange = formatDateRange(p);
              return (
                <div key={p.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                  {editing ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={editPhaseDraft.name}
                        onChange={(e) => setEditPhaseDraft((prev) => ({ ...prev, name: e.target.value }))}
                        className="flex-1 min-w-[120px] px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
                      />
                      <input
                        type="date"
                        value={editPhaseDraft.startDate}
                        onChange={(e) => setEditPhaseDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                        className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
                      />
                      <span className="text-slate-300 text-sm">-</span>
                      <input
                        type="date"
                        value={editPhaseDraft.finishDate}
                        onChange={(e) => setEditPhaseDraft((prev) => ({ ...prev, finishDate: e.target.value }))}
                        className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
                      />
                      <button onClick={saveEditPhase} className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditingPhaseId(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-medium text-indigo-700">{p.name}</span>
                        {dateRange && (
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <Calendar className="h-3 w-3" /> {dateRange}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEditPhase(p)} className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deletePhase(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {phases.length === 0 && <span className="text-sm text-slate-400">No phases yet.</span>}
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              value={newPhaseName}
              onChange={(e) => setNewPhaseName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPhase()}
              placeholder="New phase name (e.g. Design)"
              className="flex-1 min-w-[160px] px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
            <input
              type="date"
              value={newPhaseStart}
              onChange={(e) => setNewPhaseStart(e.target.value)}
              title="Start date"
              className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <input
              type="date"
              value={newPhaseFinish}
              onChange={(e) => setNewPhaseFinish(e.target.value)}
              title="Finish date"
              className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <button
              onClick={addPhase}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3.5">Add a gate</h3>
          <div className="flex flex-wrap gap-2">
            <input
              value={newGateName}
              onChange={(e) => setNewGateName(e.target.value)}
              placeholder="Gate name (e.g. Design Approval)"
              className="flex-1 min-w-[200px] px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
            <select
              value={newGatePhaseId}
              onChange={(e) => setNewGatePhaseId(e.target.value)}
              className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">No phase</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={addGate}
              disabled={!newGateName.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add gate
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {loading && <div className="text-sm text-slate-400 px-1">Loading…</div>}
          {!loading && sortedGates.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
              <EmptyState icon={Layers} title="No gates yet" description="Add one above to define your first checkpoint." />
            </div>
          )}

          {sortedGates.map((gate) => {
            const locked = isGateLocked(gate, sortedGates);
            const completed = isGateCompleted(gate);
            const status = statusLabel(gate, sortedGates);
            const expanded = expandedGateId === gate.id;
            const phase = phases.find((p) => p.id === gate.phaseId);

            return (
              <div key={gate.id} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
                <button
                  onClick={() => setExpandedGateId(expanded ? null : gate.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{gate.name}</div>
                      {phase && <div className="text-xs text-slate-400">{phase.name}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={status} />
                    <span
                      onClick={(e) => { e.stopPropagation(); deleteGate(gate.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-3 bg-slate-50/40">
                    {locked && (
                      <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5">
                        Locked until the previous gate's criteria are all approved.
                      </div>
                    )}

                    {(gate.criteria || []).map((c) => {
                      const rejected = c.reviewStatus === 'rejected';
                      const historyOpen = expandedHistoryId === c.id;
                      const submissions = c.submissions || [];
                      const reviewerNames = c.reviewStatus === 'in-progress' ? getReviewerNames(c.nextActionBy) : [];

                      return (
                        <div key={c.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="text-slate-700 font-medium">{c.description}</div>
                              {c.documentName && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                                  <FileText className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{c.documentName}</span>
                                </div>
                              )}
                              {reviewerNames.length > 0 && (
                                <div className="flex items-center gap-1.5 text-xs text-blue-500 mt-1">
                                  <UserCheck className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">Waiting on: {reviewerNames.join(', ')}</span>
                                </div>
                              )}
                            </div>

                            <CriterionStatusBadge status={c.reviewStatus} />

                            {rejected ? (
                              <button
                                onClick={() => setReviewModalTarget({ gateId: gate.id, criterionId: c.id })}
                                disabled={locked}
                                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 flex-shrink-0"
                              >
                                <RotateCcw className="h-3 w-3" /> Resubmit
                              </button>
                            ) : !c.reviewStatus || c.reviewStatus === null ? (
                              <button
                                onClick={() => setReviewModalTarget({ gateId: gate.id, criterionId: c.id })}
                                disabled={locked}
                                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 flex-shrink-0"
                              >
                                <Send className="h-3 w-3" /> Send for review
                              </button>
                            ) : null}

                            {submissions.length > 0 && (
                              <button
                                onClick={() => setExpandedHistoryId(historyOpen ? null : c.id)}
                                title="Submission history"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0"
                              >
                                <History className="h-3.5 w-3.5" />
                              </button>
                            )}

                            <span onClick={() => removeCriterion(gate.id, c.id)} className="text-slate-300 hover:text-red-500 flex-shrink-0 cursor-pointer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </span>
                          </div>

                          {historyOpen && (
                            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                              {[...submissions].reverse().map((s) => (
                                <div key={s.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                                  <div className="min-w-0">
                                    <div className="text-slate-600 font-medium">{s.workflowName}</div>
                                    <div className="text-slate-400 truncate">{s.documents.map((d) => d.name).join(', ')}</div>
                                  </div>
                                  <CriterionStatusBadge status={s.reviewStatus} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex gap-2 pt-1">
                      <input
                        value={criterionDraft[gate.id] || ''}
                        onChange={(e) => setCriterionDraft((prev) => ({ ...prev, [gate.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && addCriterion(gate.id)}
                        placeholder="New criterion (e.g. Structural drawings approved)"
                        className="flex-1 px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                      <button
                        onClick={() => addCriterion(gate.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    </div>

                    {completed && (
                      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                        All criteria approved - this gate is open.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {reviewModalTarget && (
        <SendReviewModal
          hubId={selectedHub?.id}
          projectId={projectId}
          workflows={workflows}
          defaultName={(() => {
            const gate = gates.find((g) => g.id === reviewModalTarget.gateId);
            const criterion = gate?.criteria?.find((c) => c.id === reviewModalTarget.criterionId);
            return criterion?.description ? `${gate.name} - ${criterion.description}` : gate?.name || 'Gate review';
          })()}
          onSend={handleSendForReview}
          onClose={() => setReviewModalTarget(null)}
        />
      )}
    </div>
  );
};

export default GateManager;
