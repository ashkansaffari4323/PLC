import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import FileBrowser from './components/FileBrowser';
import GateManager from './components/GateManager';
import ProjectDashboard from './components/ProjectDashboard';
import HubDashboard from './components/HubDashboard';

const AppShell = () => {
  const [activeTab, setActiveTab] = useState('gates');
  const [selectedHub, setSelectedHub] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedHub={selectedHub}
        onSelectHub={setSelectedHub}
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
      />
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'files' && <FileBrowser selectedHub={selectedHub} selectedProject={selectedProject} />}
        {activeTab === 'gates' && <GateManager selectedHub={selectedHub} selectedProject={selectedProject} />}
        {activeTab === 'dashboard' && <ProjectDashboard selectedProject={selectedProject} />}
        {activeTab === 'hub-dashboard' && <HubDashboard selectedHub={selectedHub} />}
      </main>
    </div>
  );
};

const AuthGate = () => {
  const { authenticated, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading…</div>;
  }

  return authenticated ? <AppShell /> : <Login />;
};

const App = () => (
  <AuthProvider>
    <AuthGate />
  </AuthProvider>
);

export default App;
