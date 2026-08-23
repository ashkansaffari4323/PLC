import React, { useState, useEffect, useCallback } from 'react';
import { Folder, File, ChevronRight, ArrowLeft, X, Loader2, Check, FileText } from 'lucide-react';
import { folderService } from '../api/folderService';

const MAX_FILES = 10;

/**
 * Folder-tree browser for picking up to MAX_FILES documents, which can come
 * from different folders - selections persist as you navigate around, and
 * a running tray at the bottom shows what's picked so far until you confirm.
 */
const DocumentPicker = ({ hubId, projectId, initialSelected = [], onConfirm, onClose }) => {
  const [path, setPath] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(initialSelected);

  const loadTopFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const folders = await folderService.getTopFolders(hubId, projectId);
      setItems(folders);
      setPath([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [hubId, projectId]);

  useEffect(() => {
    loadTopFolders();
  }, [loadTopFolders]);

  const openFolder = async (folder) => {
    setLoading(true);
    setError(null);
    try {
      const contents = await folderService.getFolderContents(projectId, folder.id);
      setItems(contents);
      setPath((prev) => [...prev, folder]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = async () => {
    if (path.length === 0) return;
    if (path.length === 1) return loadTopFolders();
    const newPath = path.slice(0, -1);
    const target = newPath[newPath.length - 1];
    setLoading(true);
    try {
      const contents = await folderService.getFolderContents(projectId, target.id);
      setItems(contents);
      setPath(newPath);
    } finally {
      setLoading(false);
    }
  };

  const isSelected = (fileId) => selected.some((f) => f.id === fileId);

  const toggleFile = async (file) => {
    if (isSelected(file.id)) {
      setSelected((prev) => prev.filter((f) => f.id !== file.id));
      return;
    }
    if (selected.length >= MAX_FILES) {
      setError(`You can attach up to ${MAX_FILES} files.`);
      return;
    }
    setResolvingId(file.id);
    setError(null);
    try {
      const resolved = await folderService.getItem(projectId, file.id);
      if (!resolved.tipVersionId) {
        setError(`Couldn't find a current version for "${file.name}". It may still be processing.`);
        return;
      }
      setSelected((prev) => [...prev, { id: file.id, name: resolved.name || file.name, versionId: resolved.tipVersionId }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setResolvingId(null);
    }
  };

  const removeSelected = (fileId) => setSelected((prev) => prev.filter((f) => f.id !== fileId));

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Select documents</h3>
            <p className="text-xs text-slate-400 mt-0.5">Up to {MAX_FILES} files, from any folder</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 text-xs text-slate-500 border-b border-slate-100 bg-slate-50/50">
          <button onClick={goBack} disabled={path.length === 0} className="p-1 rounded hover:bg-slate-200/60 disabled:opacity-30 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-medium">Top folders</span>
          {path.map((p) => (
            <React.Fragment key={p.id}>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <span>{p.name}</span>
            </React.Fragment>
          ))}
        </div>

        {error && <div className="mx-5 mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">{error}</div>}

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading && <div className="p-5 text-sm text-slate-400">Loading…</div>}
          {!loading && items.length === 0 && <div className="p-5 text-sm text-slate-400">This folder is empty.</div>}
          {!loading &&
            items.map((item) => {
              const checked = item.type !== 'folder' && isSelected(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => (item.type === 'folder' ? openFolder(item) : toggleFile(item))}
                  disabled={resolvingId === item.id}
                  className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors disabled:opacity-50 ${
                    checked ? 'bg-indigo-50/70 hover:bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  {item.type === 'folder' ? (
                    <Folder className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                  ) : checked ? (
                    <span className="w-4 h-4 rounded bg-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  ) : (
                    <File className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  )}
                  <span className={`text-sm truncate flex-1 ${checked ? 'text-indigo-900 font-medium' : 'text-slate-700'}`}>{item.name}</span>
                  {resolvingId === item.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                </button>
              );
            })}
        </div>

        <div className="border-t border-slate-100 px-5 py-3.5 bg-slate-50/60">
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selected.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-2.5 pr-1.5 py-1 text-xs text-slate-600">
                  <FileText className="h-3 w-3 text-slate-400" />
                  <span className="max-w-[140px] truncate">{f.name}</span>
                  <button onClick={() => removeSelected(f.id)} className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-3">No documents selected yet - click files above to add them.</p>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3.5 py-2 text-sm font-medium rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(selected)}
              disabled={selected.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              Use {selected.length || ''} file{selected.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentPicker;
