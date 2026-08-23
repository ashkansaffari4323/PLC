// server/sessionStore.js
//
// Holds each signed-in user's APS access/refresh tokens server-side, keyed
// by a random session id that's set as an httpOnly cookie. The browser only
// ever sees the opaque session id - never the actual APS tokens - which is
// why 3-legged auth has to go through this backend rather than living in
// the frontend.
//
// In-memory only: sessions are lost on server restart, which is fine for a
// dev/small-team tool. For production, swap this Map for Redis or a DB
// table and keep the same function signatures.

const crypto = require('crypto');

const sessions = new Map(); // sessionId -> { accessToken, refreshToken, expiresAt, userProfile }

function createSession(tokenData) {
  const sessionId = crypto.randomBytes(24).toString('hex');
  sessions.set(sessionId, { ...tokenData });
  return sessionId;
}

function getSession(sessionId) {
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

function updateSession(sessionId, updates) {
  const existing = sessions.get(sessionId);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  sessions.set(sessionId, updated);
  return updated;
}

function destroySession(sessionId) {
  sessions.delete(sessionId);
}

module.exports = { createSession, getSession, updateSession, destroySession };
