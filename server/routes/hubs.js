const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { apsRequest, APS_PROJECT_BASE } = require('../apsClient');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await apsRequest(req.apsToken, { url: `${APS_PROJECT_BASE}/hubs` });
    const hubs = (data.data || []).map((h) => ({
      id: h.id,
      name: h.attributes?.name,
      region: h.attributes?.region,
      extensionType: h.attributes?.extension?.type,
    }));
    res.json({ hubs });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
});

router.get('/:hubId/projects', requireAuth, async (req, res) => {
  try {
    const data = await apsRequest(req.apsToken, {
      url: `${APS_PROJECT_BASE}/hubs/${req.params.hubId}/projects`,
    });
    const projects = (data.data || []).map((p) => ({
      id: p.id,
      name: p.attributes?.name,
      status: p.attributes?.extension?.data?.status,
      startDate: p.attributes?.extension?.data?.startDate,
    }));
    res.json({ projects });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
});

module.exports = router;
