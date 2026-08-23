// server/middleware/requireAuth.js
//
// Any route that calls an APS API on behalf of the signed-in user (hubs,
// projects, folders, reviews) needs a valid 3-legged access token. This
// middleware pulls it from the session tied to the httpOnly cookie,
// transparently refreshes it if it's about to expire, and attaches it to
// req.apsToken. Routes that don't need user-context APS calls (gates/phases
// storage) don't use this.

const sessionStore = require('../sessionStore');
const { refreshToken } = require('../apsClient');

const SESSION_COOKIE = 'plc_session';

async function requireAuth(req, res, next) {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  const session = sessionStore.getSession(sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Not signed in. Start 3-legged login at /api/auth/login.' });
  }

  const expiresInMs = session.expiresAt - Date.now();
  if (expiresInMs < 60_000) {
    try {
      const refreshed = await refreshToken(session.refreshToken);
      sessionStore.updateSession(sessionId, refreshed);
      req.apsToken = refreshed.accessToken;
    } catch (error) {
      console.error('Failed to refresh APS token:', error.message);
      sessionStore.destroySession(sessionId);
      res.clearCookie(SESSION_COOKIE);
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
  } else {
    req.apsToken = session.accessToken;
  }

  req.sessionId = sessionId;
  next();
}

module.exports = { requireAuth, SESSION_COOKIE };
