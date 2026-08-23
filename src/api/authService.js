import { apiClient } from './client';

// The backend's real address. A full-page navigation (window.location.href)
// bypasses CRA's dev-server proxy - that proxy only forwards background
// fetch/XHR calls, not top-level page loads - so the login redirect has to
// point straight at the Express server rather than a relative /api path.
//
// In local dev the frontend (:3000) and backend (:3001) are different
// origins, so REACT_APP_API_BASE in .env has to say so explicitly. In a
// real deployment like Vercel, though, one server serves both the API and
// the built frontend from the same origin - so if REACT_APP_API_BASE was
// never set (or a build ran before it was), falling back to
// window.location.origin still gets the right answer instead of a
// hardcoded localhost address that can never work once deployed.
const BACKEND_ORIGIN = process.env.REACT_APP_API_BASE || window.location.origin;

export const authService = {
  getStatus: () => apiClient.get('/api/auth/status'),
  loginUrl: () => `${BACKEND_ORIGIN}/api/auth/login`, // full page navigation, not fetch - starts the APS redirect
  logout: () => apiClient.post('/api/auth/logout'),
  whoami: () => apiClient.get('/api/auth/whoami'),
};
