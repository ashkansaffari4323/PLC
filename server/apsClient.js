// server/apsClient.js
//
// All direct communication with Autodesk Platform Services (APS) lives here:
// building the 3-legged authorize URL, exchanging codes/refresh tokens,
// getting a 2-legged (client credentials) token for account-admin-style
// calls, and a thin authenticated-request wrapper other routes build on.
//
// Nothing in this file ever exposes APS_CLIENT_SECRET to the browser - it's
// read once from process.env and used only in server-to-server calls.

const axios = require('axios');

const APS_AUTH_BASE = 'https://developer.api.autodesk.com/authentication/v2';
const APS_DM_BASE = 'https://developer.api.autodesk.com/data/v1';
const APS_PROJECT_BASE = 'https://developer.api.autodesk.com/project/v1';
const APS_HQ_BASE = 'https://developer.api.autodesk.com/hq/v1';
const APS_CONSTRUCTION_BASE = 'https://developer.api.autodesk.com/construction';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

/** Builds the URL the browser is redirected to for 3-legged sign-in. */
function getAuthorizeUrl(state) {
  const clientId = requireEnv('APS_CLIENT_ID');
  const callbackUrl = requireEnv('APS_CALLBACK_URL');
  const scopes = process.env.APS_SCOPES || 'data:read data:write data:create account:read user-profile:read';

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: scopes,
    state: state || '',
  });

  return `${APS_AUTH_BASE}/authorize?${params.toString()}`;
}

/** Exchanges a 3-legged authorization code for access/refresh tokens. */
async function exchangeCodeForToken(code) {
  const clientId = requireEnv('APS_CLIENT_ID');
  const clientSecret = requireEnv('APS_CLIENT_SECRET');
  const callbackUrl = requireEnv('APS_CALLBACK_URL');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
  });

  const { data } = await axios.post(`${APS_AUTH_BASE}/token`, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
  });

  return normalizeTokenResponse(data);
}

/** Uses a refresh token to get a new 3-legged access token without re-prompting login. */
async function refreshToken(refreshTokenValue) {
  const clientId = requireEnv('APS_CLIENT_ID');
  const clientSecret = requireEnv('APS_CLIENT_SECRET');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
  });

  const { data } = await axios.post(`${APS_AUTH_BASE}/token`, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
  });

  return normalizeTokenResponse(data);
}

// Cached in-process; a 2-legged token has no per-user identity so one
// cached token can serve every request until it's close to expiring.
let cachedTwoLeggedToken = null; // { accessToken, expiresAt }

/** Gets (and caches) a 2-legged client-credentials token for account/admin-scoped calls. */
async function getTwoLeggedToken() {
  const now = Date.now();
  if (cachedTwoLeggedToken && cachedTwoLeggedToken.expiresAt - now > 60_000) {
    return cachedTwoLeggedToken.accessToken;
  }

  const clientId = requireEnv('APS_CLIENT_ID');
  const clientSecret = requireEnv('APS_CLIENT_SECRET');
  const scopes = 'data:read data:write account:read';

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: scopes,
  });

  const { data } = await axios.post(`${APS_AUTH_BASE}/token`, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
  });

  cachedTwoLeggedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedTwoLeggedToken.accessToken;
}

function normalizeTokenResponse(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/** Generic authenticated GET/POST/PATCH/DELETE against any APS REST endpoint. */
async function apsRequest(accessToken, { method = 'GET', url, data, params, headers } = {}) {
  try {
    const response = await axios({
      method,
      url,
      data,
      params,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(data ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const details = error.response?.data;
    const wrapped = new Error(`APS request failed (${method} ${url}): ${status || error.message}`);
    wrapped.status = status || 500;
    wrapped.details = details;
    throw wrapped;
  }
}

module.exports = {
  APS_DM_BASE,
  APS_PROJECT_BASE,
  APS_HQ_BASE,
  APS_CONSTRUCTION_BASE,
  getAuthorizeUrl,
  exchangeCodeForToken,
  refreshToken,
  getTwoLeggedToken,
  apsRequest,
};
