// server/dataStore.js
//
// Persistence for gate/phase configuration. Tries three backends, in order:
//
//   1. MongoDB (if MONGODB_URI is set) - a MongoDB Atlas free-tier cluster,
//      completely independent of Vercel's own storage marketplace. This is
//      the recommended option if you don't want anything Vercel-branded.
//   2. Vercel-compatible KV/Redis (if KV_REST_API_URL is set) - kept as a
//      fallback for anyone who already connected that.
//   3. A JSON-file-per-project store under ./data - used for local dev,
//      and fine for a normal always-on server deployment, but this one
//      does NOT work on Vercel's serverless functions (read-only
//      filesystem outside a request's own /tmp, which doesn't even
//      persist between invocations anyway).
//
// Setting up MongoDB Atlas (free, ~5 minutes):
//   1. Create a free cluster at https://www.mongodb.com/cloud/atlas/register
//   2. Database Access -> add a user with a password.
//   3. Network Access -> allow access from anywhere (0.0.0.0/0) - Vercel's
//      serverless functions don't have a fixed IP, so this is required.
//   4. Connect -> "Drivers" -> copy the connection string, put your
//      password in it.
//   5. Add it to Vercel as MONGODB_URI, then redeploy.

const fs = require('fs-extra');
const path = require('path');

const mongoUri = process.env.MONGODB_URI;
const useMongo = !!mongoUri;

const useKv = !useMongo && !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
// eslint-disable-next-line global-require
const kv = useKv ? require('@vercel/kv').kv : null;

const DATA_DIR = path.join(__dirname, '..', 'data');

function safeId(id) {
  const cleaned = String(id || '').replace(/[^a-zA-Z0-9._:-]/g, '');
  if (!cleaned) throw new Error('Invalid id');
  return cleaned;
}

// --- MongoDB ---------------------------------------------------------------
// The client connection is cached at module scope (not recreated per call)
// so a warm serverless invocation reuses it instead of opening a fresh
// connection to Atlas on every single request.
let cachedMongoClientPromise = null;

function getMongoClientPromise() {
  if (!cachedMongoClientPromise) {
    // eslint-disable-next-line global-require
    const { MongoClient } = require('mongodb');
    cachedMongoClientPromise = new MongoClient(mongoUri).connect();
  }
  return cachedMongoClientPromise;
}

async function getMongoCollection(kind) {
  const client = await getMongoClientPromise();
  return client.db(process.env.MONGODB_DB || 'plc').collection(kind);
}

async function readMongoCollection(kind, id) {
  const collection = await getMongoCollection(kind);
  const doc = await collection.findOne({ _id: safeId(id) });
  return Array.isArray(doc?.value) ? doc.value : [];
}

async function writeMongoCollection(kind, id, value) {
  const collection = await getMongoCollection(kind);
  await collection.updateOne({ _id: safeId(id) }, { $set: { value } }, { upsert: true });
  return value;
}

// --- File fallback (local dev / plain server deployments) ------------------
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

// --- Unified read/write, picking whichever backend is configured -----------
async function readCollection(kind, id) {
  if (useMongo) {
    try {
      return await readMongoCollection(kind, id);
    } catch (error) {
      console.error(`[dataStore] Mongo read failed for ${kind}/${id}:`, error.message);
      return [];
    }
  }
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
  if (useMongo) {
    return writeMongoCollection(kind, id, value);
  }
  if (useKv) {
    await kv.set(`${kind}:${safeId(id)}`, value);
    return value;
  }
  if (process.env.VERCEL) {
    // Running on Vercel with no database connected - file writes will
    // always fail here (read-only serverless filesystem), so fail with an
    // actionable message instead of a cryptic EROFS error.
    throw new Error(
      'Gate/phase storage needs a database connected to this Vercel project - ' +
      'set MONGODB_URI (MongoDB Atlas, free) in your environment variables, then redeploy. ' +
      "File-based storage does not work on Vercel's serverless functions."
    );
  }
  return writeFileCollection(kind, id, value);
}

module.exports = {
  getGates: (projectId) => readCollection('gates', projectId),
  saveGates: (projectId, gates) => writeCollection('gates', projectId, gates),
  getPhases: (projectId) => readCollection('phases', projectId),
  savePhases: (projectId, phases) => writeCollection('phases', projectId, phases),
};
