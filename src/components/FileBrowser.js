import React, { useState, useEffect, useCallback } from 'react';
import { formatError } from '../api/client';
import { Folder, File, ChevronRight, ArrowLeft, Files } from 'lucide-react';
import { folderService } from '../api/folderService';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';

const FileBrowser = ({ selectedHub, selectedProject }) => {
  const [path, setPath] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTopFolders = useCallback(async () => {
    if (!selectedHub?.id || !selectedProject?.id) return;
    setLoading(true);
    setError(null);
    try {
      const folders = await folderService.getTopFolders(selectedHub.id, selectedProject.id);
      setItems(folders);
      setPath([]);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedHub?.id, selectedProject?.id]);

  useEffect(() => {
    loadTopFolders();
  }, [loadTopFolders]);

  const openFolder = async (folder) => {
    setLoading(true);
    setError(null);
    try {
      const contents = await folderService.getFolderContents(selectedProject.id, folder.id);
      setItems(contents);
      setPath((prev) => [...prev, folder]);
    } catch (err) {
      setError(formatError(err));
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
      const contents = await folderService.getFolderContents(selectedProject.id, target.id);
      setItems(contents);
      setPath(newPath);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedProject) {
    return (
      <div className="p-6">
        <EmptyState icon={Files} title="No project selected" description="Choose a project from the sidebar to browse its files." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader icon={Files} title="Files" subtitle={selectedProject.name} />

      <div className="flex items-center gap-2 mb-3 text-sm text-slate-500">
        <button
          onClick={goBack}
          disabled={path.length === 0}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="font-medium text-slate-700">Top folders</span>
        {path.map((p) => (
          <React.Fragment key={p.id}>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span>{p.name}</span>
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {loading && <div className="p-5 text-sm text-slate-400">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="p-1">
            <EmptyState icon={Folder} title="This folder is empty" />
          </div>
        )}
        {!loading &&
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => item.type === 'folder' && openFolder(item)}
              disabled={item.type !== 'folder'}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:hover:bg-white transition-colors"
            >
              {item.type === 'folder' ? (
                <Folder className="h-4 w-4 text-indigo-500 flex-shrink-0" />
              ) : (
                <File className="h-4 w-4 text-slate-400 flex-shrink-0" />
              )}
              <span className="text-sm text-slate-700 truncate">{item.name}</span>
            </button>
          ))}
      </div>
    </div>
  );
};

export default FileBrowser;
