import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Files, ShieldCheck, LayoutDashboard, LogOut } from 'lucide-react';
import { hubService } from '../api/hubService';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { id: 'files', label: 'Files', icon: Files, needsProject: true },
  { id: 'gates', label: 'Gates & Phases', icon: ShieldCheck, needsProject: true },
  { id: 'dashboard', label: 'Project Dashboard', icon: LayoutDashboard, needsProject: true },
  { id: 'hub-dashboard', label: 'Hub Dashboard', icon: Building2, needsProject: false },
];

const Sidebar = ({ activeTab, onTabChange, selectedHub, onSelectHub, selectedProject, onSelectProject }) => {
  const [hubs, setHubs] = useState([]);
  const [projects, setProjects] = useState([]);
  const { logout } = useAuth();

  useEffect(() => {
    hubService.getHubs().then(setHubs).catch(() => setHubs([]));
  }, []);

  const loadProjects = useCallback((hubId) => {
    if (!hubId) return setProjects([]);
    hubService.getProjects(hubId).then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    loadProjects(selectedHub?.id);
  }, [selectedHub?.id, loadProjects]);

  return (
    <div className="w-72 bg-white border-r border-slate-200/70 flex flex-col h-screen">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-sm shadow-indigo-200">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <span className="font-bold text-slate-900 text-[15px]">PLC</span>
        </div>

        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hub</label>
        <select
          value={selectedHub?.id || ''}
          onChange={(e) => {
            const hub = hubs.find((h) => h.id === e.target.value) || null;
            onSelectHub(hub);
            onSelectProject(null);
          }}
          className="w-full mt-1.5 mb-4 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:bg-white transition-colors"
        >
          <option value="">Select a hub…</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>

        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Project</label>
        <select
          value={selectedProject?.id || ''}
          onChange={(e) => onSelectProject(projects.find((p) => p.id === e.target.value) || null)}
          disabled={!selectedHub}
          className="w-full mt-1.5 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:bg-white transition-colors disabled:opacity-50 disabled:bg-slate-50"
        >
          <option value="">Select a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const disabled = item.needsProject && !selectedProject;
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => !disabled && onTabChange(item.id)}
              disabled={disabled}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-indigo-50 text-indigo-700 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.15)]'
                  : disabled
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-100">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
