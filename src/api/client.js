// src/api/client.js
//
// Every backend call goes through here. `credentials: 'include'` is what
// makes the httpOnly session cookie (set during 3-legged login) get sent
// along automatically - the frontend never touches the actual APS tokens.
//
// On a 401 (session gone - e.g. the backend restarted, wiping its
// in-memory sessions, or the refresh token finally expired) this fires a
// window event that AuthContext listens for, so the whole app snaps back
// to the login screen immediately instead of leaving stale data on screen
// next to scattered per-component error banners.

function notifySessionExpired() {
  window.dispatchEvent(new Event('plc:session-expired'));
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // no JSON body (e.g. a 204) - that's fine
  }

  if (response.status === 401) {
    notifySessionExpired();
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed: ${response.status}`);
    error.status = response.status;
    error.details = data?.details;
    throw error;
  }

  return data;
}

export const apiClient = {
  get: (path, params) => request(path, { method: 'GET', params }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  post: (path, body) => request(path, { method: 'POST', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

/** Combines an error's generic message with the backend's real detail, when present, for display. */
export function formatError(err) {
  if (!err) return 'Unknown error';
  if (err.details) {
    const detailText = typeof err.details === 'string' ? err.details : JSON.stringify(err.details);
    return `${err.message}: ${detailText}`;
  }
  return err.message;
}
