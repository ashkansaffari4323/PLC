// server/middleware/requireAuth.js
//
// Any route that calls an APS API on behalf of the signed-in user (hubs,
// projects, folders, reviews) needs a valid 3-legged access token. This
// middleware decrypts it straight from the session cookie, transparently
// refreshes it if it's about to expire, and attaches it to req.apsToken.
// Because sessions are stateless (see cookieSession.js), a refresh means
// re-issuing the cookie with new encrypted contents on this same response
// - there's no server-side record to update instead.

const { decryptSession, encryptSession } = require('../cookieSession');
const { refreshToken } = require('../apsClient');

const SESSION_COOKIE = 'plc_session';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days; refresh token carries the session forward
};

async function requireAuth(req, res, next) {
  const session = decryptSession(req.cookies?.[SESSION_COOKIE]);

  if (!session) {
    return res.status(401).json({ error: 'Not signed in. Start 3-legged login at /api/auth/login.' });
  }

  const expiresInMs = session.expiresAt - Date.now();
  if (expiresInMs < 60_000) {
    try {
      const refreshed = await refreshToken(session.refreshToken);
      res.cookie(SESSION_COOKIE, encryptSession(refreshed), cookieOptions);
      req.apsToken = refreshed.accessToken;
    } catch (error) {
      console.error('Failed to refresh APS token:', error.message);
      res.clearCookie(SESSION_COOKIE);
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
  } else {
    req.apsToken = session.accessToken;
  }

  next();
}

module.exports = { requireAuth, SESSION_COOKIE, cookieOptions };
