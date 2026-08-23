import { apiClient } from './client';

// The backend's real address. A full-page navigation (window.location.href)
// bypasses CRA's dev-server proxy - that proxy only forwards background
// fetch/XHR calls, not top-level page loads - so the login redirect has to
// point straight at the Express server rather than a relative /api path.
const BACKEND_ORIGIN = process.env.REACT_APP_API_BASE || 'http://localhost:3001';

export const authService = {
  getStatus: () => apiClient.get('/api/auth/status'),
  loginUrl: () => `${BACKEND_ORIGIN}/api/auth/login`, // full page navigation, not fetch - starts the APS redirect
  logout: () => apiClient.post('/api/auth/logout'),
  whoami: () => apiClient.get('/api/auth/whoami'),
};
