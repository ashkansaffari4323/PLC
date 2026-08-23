const express = require('express');
const store = require('../dataStore');

const router = express.Router();

// Gate/phase storage doesn't call APS directly, so it doesn't need
// requireAuth - it's pure backend state. (For a multi-tenant deployment
// you'd still want to gate this behind requireAuth or an API key so
// arbitrary callers can't read/write another team's gates; kept open here
// to match the MVP scope.)

router.get('/projects/:projectId/gates', async (req, res) => {
  try {
    const gates = await store.getGates(req.params.projectId);
    res.json({ gates });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load gates', details: error.message });
  }
});

router.put('/projects/:projectId/gates', async (req, res) => {
  try {
    const { gates } = req.body;
    if (!Array.isArray(gates)) {
      return res.status(400).json({ error: 'Request body must include a "gates" array' });
    }
    const saved = await store.saveGates(req.params.projectId, gates);
    res.json({ gates: saved });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save gates', details: error.message });
  }
});

router.get('/projects/:projectId/phases', async (req, res) => {
  try {
    const phases = await store.getPhases(req.params.projectId);
    res.json({ phases });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load phases', details: error.message });
  }
});

router.put('/projects/:projectId/phases', async (req, res) => {
  try {
    const { phases } = req.body;
    if (!Array.isArray(phases)) {
      return res.status(400).json({ error: 'Request body must include a "phases" array' });
    }
    const saved = await store.savePhases(req.params.projectId, phases);
    res.json({ phases: saved });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save phases', details: error.message });
  }
});

// Bulk read for the hub-level dashboard: one call instead of N.
router.get('/hub/gates', async (req, res) => {
  try {
    const projectIds = String(req.query.projectIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (projectIds.length === 0) {
      return res.status(400).json({ error: 'projectIds query parameter is required, e.g. ?projectIds=a,b,c' });
    }

    const entries = await Promise.all(
      projectIds.map(async (projectId) => {
        const [gates, phases] = await Promise.all([store.getGates(projectId), store.getPhases(projectId)]);
        return [projectId, { gates, phases }];
      })
    );

    res.json({ projects: Object.fromEntries(entries) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load hub gate data', details: error.message });
  }
});

module.exports = router;
