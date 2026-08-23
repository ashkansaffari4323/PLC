// server/dataStore.js
//
// Persistence for gate/phase configuration, one JSON file per project under
// ./data. This is a real backend store (shared across every user hitting
// this server) rather than browser localStorage, which is what makes a
// hub-level dashboard possible at all - it needs one place to read every
// project's gates from.
//
// Not suitable for serverless hosts with an ephemeral/read-only filesystem
// (e.g. Vercel functions). If deploying there, swap these functions for
// calls to a real database and keep the same signatures - nothing else in
// the app needs to change.

const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function safeId(id) {
  const cleaned = String(id || '').replace(/[^a-zA-Z0-9._:-]/g, '');
  if (!cleaned) throw new Error('Invalid id');
  return cleaned;
}

function collectionFile(kind, id) {
  return path.join(DATA_DIR, kind, `${safeId(id)}.json`);
}

async function readCollection(kind, id) {
  const filePath = collectionFile(kind, id);
  try {
    if (!(await fs.pathExists(filePath))) return [];
    const content = await fs.readFile(filePath, 'utf8');
    if (!content.trim()) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`[dataStore] read failed for ${kind}/${id}:`, error.message);
    return [];
  }
}

async function writeCollection(kind, id, value) {
  const filePath = collectionFile(kind, id);
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, value, { spaces: 2 });
  return value;
}

module.exports = {
  getGates: (projectId) => readCollection('gates', projectId),
  saveGates: (projectId, gates) => writeCollection('gates', projectId, gates),
  getPhases: (projectId) => readCollection('phases', projectId),
  savePhases: (projectId, phases) => writeCollection('phases', projectId, phases),
};
