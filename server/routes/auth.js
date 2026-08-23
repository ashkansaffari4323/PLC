const express = require('express');
const crypto = require('crypto');
const aps = require('../apsClient');
const { encryptSession, decryptSession } = require('../cookieSession');
const { requireAuth, SESSION_COOKIE, cookieOptions } = require('../middleware/requireAuth');

const router = express.Router();

// Where to send the browser back to after a successful/failed login. If
// FRONTEND_URL isn't set, fall back to whatever host actually served this
// request - correct for any single-domain deployment (Vercel, a plain VM
// serving both API and frontend) without needing a separately-configured
// variable that's easy to forget or leave pointed at localhost.
function resolveFrontendUrl(req) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  // req.get('host') reads the raw Host header, which isn't proxy-aware -
  // behind Vercel's proxy the real public host is in X-Forwarded-Host.
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${req.protocol}://${host}`;
}

// Kicks off 3-legged sign-in: redirect the browser to Autodesk's login page.
router.get('/login', (req, res) => {
  const state = crypto.randomBytes(8).toString('hex');
  const url = aps.getAuthorizeUrl(state);
  res.redirect(url);
});

// Autodesk redirects back here with a one-time code after the user signs in.
router.get('/callback', async (req, res) => {
  const { code, error, error_description: errorDescription } = req.query;
  const frontendUrl = resolveFrontendUrl(req);

  if (error) {
    console.error('APS login error:', error, errorDescription);
    return res.redirect(`${frontendUrl}/?authError=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}/?authError=missing_code`);
  }

  try {
    const tokenData = await aps.exchangeCodeForToken(code);
    res.cookie(SESSION_COOKIE, encryptSession(tokenData), cookieOptions);
    res.redirect(frontendUrl);
  } catch (err) {
    console.error('Failed to exchange APS auth code:', err.message, err.details);
    res.redirect(`${frontendUrl}/?authError=token_exchange_failed`);
  }
});

// Frontend polls this to know whether it should show "Sign in" or the app.
router.get('/status', async (req, res) => {
  const session = decryptSession(req.cookies?.[SESSION_COOKIE]);

  if (!session) {
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    expiresAt: session.expiresAt,
  });
});

router.post('/logout', (req, res) => {
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
