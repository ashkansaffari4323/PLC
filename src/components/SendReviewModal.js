import React, { useState } from 'react';
import { X, FileText, Folder, Send, Loader2 } from 'lucide-react';
import DocumentPicker from './DocumentPicker';

/**
 * The full "send for review" flow in one place: pick which of the
 * project's real ACC workflows to run, pick one or more documents from the
 * folder tree, then send. Used both for a criterion's first submission and
 * for resubmitting after a rejection.
 */
const SendReviewModal = ({ hubId, projectId, workflows, defaultName, onSend, onClose }) => {
  const [workflowId, setWorkflowId] = useState('');
  const [name, setName] = useState(defaultName || '');
  const [files, setFiles] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async () => {
    if (!workflowId || files.length === 0 || !name.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onSend(workflowId, files, name.trim());
    } catch (err) {
      // Show Autodesk's actual error body, not just our generic message -
      // it names the exact field/shape it wanted, which beats guessing.
      const detailText = err.details ? JSON.stringify(err.details, null, 2) : null;
      setError(detailText ? `${err.message}\n\n${detailText}` : err.message);
      setSending(false);
    }
  };

  if (showPicker) {
    return (
      <DocumentPicker
        hubId={hubId}
        projectId={projectId}
        initialSelected={files}
        onConfirm={(selected) => { setFiles(selected); setShowPicker(false); }}
        onClose={() => setShowPicker(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Send for review</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Review name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Structural drawings - Design review"
              className="w-full mt-1.5 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Review workflow</label>
            <select
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              className="w-full mt-1.5 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:bg-white transition-colors"
            >
              <option value="" disabled>
                {workflows.length === 0 ? 'No workflows available in this project' : 'Choose a workflow…'}
              </option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>{w.name || w.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Documents</label>
            {files.length > 0 ? (
              <div className="mt-1.5 space-y-1.5">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
                    <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              onClick={() => setShowPicker(true)}
              className="w-full mt-1.5 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-sm font-medium rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 transition-colors"
            >
              <Folder className="h-4 w-4" />
              {files.length > 0 ? 'Change documents' : 'Choose documents from project files'}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
          <button onClick={onClose} className="px-3.5 py-2 text-sm font-medium rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!workflowId || files.length === 0 || !name.trim() || sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send for review
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendReviewModal;
