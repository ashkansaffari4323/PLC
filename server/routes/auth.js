const express = require('express');
const crypto = require('crypto');
const aps = require('../apsClient');
const sessionStore = require('../sessionStore');
const { requireAuth, SESSION_COOKIE } = require('../middleware/requireAuth');

const router = express.Router();

// Where to send the browser back to after a successful/failed login.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Kicks off 3-legged sign-in: redirect the browser to Autodesk's login page.
router.get('/login', (req, res) => {
  const state = crypto.randomBytes(8).toString('hex');
  const url = aps.getAuthorizeUrl(state);
  res.redirect(url);
});

// Autodesk redirects back here with a one-time code after the user signs in.
router.get('/callback', async (req, res) => {
  const { code, error, error_description: errorDescription } = req.query;

  if (error) {
    console.error('APS login error:', error, errorDescription);
    return res.redirect(`${FRONTEND_URL}/?authError=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/?authError=missing_code`);
  }

  try {
    const tokenData = await aps.exchangeCodeForToken(code);
    const sessionId = sessionStore.createSession(tokenData);

    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days; refresh token carries the session forward
    });

    res.redirect(FRONTEND_URL);
  } catch (err) {
    console.error('Failed to exchange APS auth code:', err.message, err.details);
    res.redirect(`${FRONTEND_URL}/?authError=token_exchange_failed`);
  }
});

// Frontend polls this to know whether it should show "Sign in" or the app.
router.get('/status', async (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  const session = sessionStore.getSession(sessionId);

  if (!session) {
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    expiresAt: session.expiresAt,
  });
});

router.post('/logout', (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (sessionId) sessionStore.destroySession(sessionId);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

// Confirms the app-level (2-legged) credentials work, without requiring a
// signed-in user. Used for account-admin-style calls where there's no
// specific person to act as.
router.get('/two-legged-status', async (req, res) => {
  try {
    await aps.getTwoLeggedToken();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/whoami', requireAuth, async (req, res) => {
  try {
    const profile = await aps.apsRequest(req.apsToken, {
      url: 'https://api.userprofile.autodesk.com/userinfo',
    });
    res.json(profile);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
});

module.exports = router;
