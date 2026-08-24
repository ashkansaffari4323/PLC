// server/dataStore.js
//
// Persistence for gate/phase configuration. Uses Vercel's KV-compatible
// storage when it's configured (KV_REST_API_URL / KV_REST_API_TOKEN present
// - these get set automatically once you connect a Redis storage
// integration from the Vercel Marketplace to your project; "Vercel KV" as
// its own product is being retired in favor of these Marketplace Redis
// integrations, but they set the same env var names for compatibility, so
// this code works with either), and falls back to a JSON-file-per-project
// store under ./data otherwise - which is what local dev uses, and is
// enough for a normal always-on server deployment too.
//
// The file-based fallback does NOT work on Vercel's serverless functions -
// their filesystem is read-only outside of a request's own /tmp, and even
// that doesn't persist between invocations. If you're on Vercel, you need
// a Redis integration connected; this module can't silently work around
// that the way the auth/session fixes could, because this is real
// application data, not just a redirect URL it can infer from the request.

const fs = require('fs-extra');
const path = require('path');

const useKv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
// eslint-disable-next-line global-require
const kv = useKv ? require('@vercel/kv').kv : null;

const DATA_DIR = path.join(__dirname, '..', 'data');

function safeId(id) {
  const cleaned = String(id || '').replace(/[^a-zA-Z0-9._:-]/g, '');
  if (!cleaned) throw new Error('Invalid id');
  return cleaned;
}

function collectionFile(kind, id) {
  return path.join(DATA_DIR, kind, `${safeId(id)}.json`);
}

async function readFileCollection(kind, id) {
  const filePath = collectionFile(kind, id);
  try {
    if (!(await fs.pathExists(filePath))) return [];
    const content = await fs.readFile(filePath, 'utf8');
    if (!content.trim()) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`[dataStore] file read failed for ${kind}/${id}:`, error.message);
    return [];
  }
}

async function writeFileCollection(kind, id, value) {
  const filePath = collectionFile(kind, id);
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, value, { spaces: 2 });
  return value;
}

async function readCollection(kind, id) {
  if (useKv) {
    try {
      const value = await kv.get(`${kind}:${safeId(id)}`);
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error(`[dataStore] KV read failed for ${kind}/${id}:`, error.message);
      return [];
    }
  }
  return readFileCollection(kind, id);
}

async function writeCollection(kind, id, value) {
  if (useKv) {
    await kv.set(`${kind}:${safeId(id)}`, value);
    return value;
  }
  return writeFileCollection(kind, id, value);
}

module.exports = {
  getGates: (projectId) => readCollection('gates', projectId),
  saveGates: (projectId, gates) => writeCollection('gates', projectId, gates),
  getPhases: (projectId) => readCollection('phases', projectId),
  savePhases: (projectId, phases) => writeCollection('phases', projectId, phases),
};
