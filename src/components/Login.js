import React from 'react';
import { LogIn, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login, loginError } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-100 p-8 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-200">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-1.5">Project Lifecycle Control</h1>
        <p className="text-sm text-slate-500 mb-5 leading-relaxed">
          Sign in with your Autodesk account to access your hubs, projects, and gate reviews.
        </p>

        {loginError && (
          <div className="flex items-start gap-2 text-left text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3 mb-5">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="break-words">Sign-in failed: {loginError}</span>
          </div>
        )}

        <button
          onClick={login}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
        >
          <LogIn className="h-4 w-4" />
          Sign in with Autodesk
        </button>
        <p className="text-xs text-slate-400 mt-5">
          Uses APS 3-legged OAuth - your credentials go directly to Autodesk, never through this app.
        </p>
      </div>
    </div>
  );
};

export default Login;
