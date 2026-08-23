// server/routes/reviews.js
//
// Thin proxy over the ACC Reviews API (construction/reviews/v1). The
// frontend never calls Autodesk directly - it hits these routes, which
// attach the signed-in user's token. Autodesk's official reference confirms
// these endpoints accept a project ID with or without the "b." prefix, but
// we strip it anyway for consistency with the Data Management calls
// elsewhere in this app.

const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { apsRequest } = require('../apsClient');

const router = express.Router();

const REVIEWS_BASE = 'https://developer.api.autodesk.com/construction/reviews/v1';

function cleanProjectId(projectId) {
  return projectId?.startsWith('b.') ? projectId.slice(2) : projectId;
}

// Approval workflow definitions available in this project (used when
// creating a new review - you pick which workflow to run).
router.get('/projects/:projectId/workflows', requireAuth, async (req, res) => {
  try {
    const projectId = cleanProjectId(req.params.projectId);
    const data = await apsRequest(req.apsToken, {
      url: `${REVIEWS_BASE}/projects/${projectId}/workflows`,
      params: { 'filter[initiator]': 'true' },
    });
    res.json({ workflows: data.results || data.data || [] });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
});

// All review instances in the project.
router.get('/projects/:projectId/reviews', requireAuth, async (req, res) => {
  try {
    const projectId = cleanProjectId(req.params.projectId);
    const data = await apsRequest(req.apsToken, {
      url: `${REVIEWS_BASE}/projects/${projectId}/reviews`,
    });
    res.json({ reviews: data.results || data.data || [] });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
});

// Initiate a new review against a workflow - this is how a gate's criterion
// gets "sent for review".
router.post('/projects/:projectId/reviews', requireAuth, async (req, res) => {
  try {
    const projectId = cleanProjectId(req.params.projectId);
    const data = await apsRequest(req.apsToken, {
      method: 'POST',
      url: `${REVIEWS_BASE}/projects/${projectId}/reviews`,
      data: req.body,
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
});

// Current approval-step-by-step progress of a single review - this is what
// the gate engine reads to decide whether a criterion is satisfied.
router.get('/projects/:projectId/reviews/:reviewId/progress', requireAuth, async (req, res) => {
  try {
    const projectId = cleanProjectId(req.params.projectId);
    const data = await apsRequest(req.apsToken, {
      url: `${REVIEWS_BASE}/projects/${projectId}/reviews/${req.params.reviewId}/progress`,
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
});

router.get('/projects/:projectId/reviews/:reviewId', requireAuth, async (req, res) => {
  try {
    const projectId = cleanProjectId(req.params.projectId);
    const data = await apsRequest(req.apsToken, {
      url: `${REVIEWS_BASE}/projects/${projectId}/reviews/${req.params.reviewId}`,
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
});

module.exports = router;
