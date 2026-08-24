import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../api/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(null); // null = not checked yet
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const status = await authService.getStatus();
      setAuthenticated(!!status.authenticated);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The backend redirects back here with ?authError=... when sign-in fails
  // (bad client secret, callback URL mismatch, etc.) - surface it instead
  // of silently landing back on a blank login screen with no explanation,
  // then clean the URL so it doesn't linger through a refresh.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('authError');
    if (authError) {
      setLoginError(authError);
      params.delete('authError');
      const newSearch = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
    }
  }, []);

  // Any API call getting a 401 means the session is gone (e.g. the dev
  // backend restarted and wiped its in-memory sessions). Snap straight
  // back to the login screen instead of leaving stale UI on screen.
  useEffect(() => {
    const handleExpired = () => setAuthenticated(false);
    window.addEventListener('plc:session-expired', handleExpired);
    return () => window.removeEventListener('plc:session-expired', handleExpired);
  }, []);

  const login = () => {
    window.location.href = authService.loginUrl();
  };

  const logout = async () => {
    await authService.logout();
    setAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ authenticated, loading, login, logout, refresh, loginError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
