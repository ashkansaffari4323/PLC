// server/cookieSession.js
//
// Stateless session handling: instead of keeping tokens in a server-side
// Map keyed by a session id (which breaks on serverless platforms like
// Vercel, where each request can hit a fresh instance with empty memory),
// the token data itself is encrypted and stored directly in the cookie.
// The browser still never sees the plaintext tokens - only ciphertext it
// can't read or modify - but the server needs no memory of who's signed
// in between requests, so this works identically on a long-running server
// or a serverless one.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('Missing required environment variable: SESSION_SECRET. Copy .env.example to .env and fill it in.');
  }
  // Derive a fixed-length key from whatever string length the user set.
  return crypto.createHash('sha256').update(secret).digest();
}

/** Encrypts a JSON-serializable session payload into a single string safe to store in a cookie. */
function encryptSession(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv.authTag.ciphertext, all base64url so it's cookie-safe.
  return [iv, authTag, encrypted].map((b) => b.toString('base64url')).join('.');
}

/** Decrypts a cookie value back into the session payload, or null if it's missing/invalid/tampered. */
function decryptSession(cookieValue) {
  if (!cookieValue) return null;
  try {
    const [ivB64, authTagB64, encryptedB64] = cookieValue.split('.');
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(authTagB64, 'base64url');
    const encrypted = Buffer.from(encryptedB64, 'base64url');

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch {
    // Wrong/rotated SESSION_SECRET, corrupted cookie, or tampering - treat
    // exactly like "not signed in" rather than crashing the request.
    return null;
  }
}

module.exports = { encryptSession, decryptSession };
