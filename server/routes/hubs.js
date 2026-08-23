const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { apsRequest, APS_PROJECT_BASE, APS_HQ_BASE } = require('../apsClient');

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

// Lists every project in the hub, not just ones the signed-in user is a
// member of - the "hub admin" view. This has to use a different Autodesk
// API than the member-scoped one below: the Data Management API's
// /hubs/:hubId/projects only ever returns projects you've been personally
// added to, with no way to see the rest even as an admin. The BIM
// 360/ACC Account Admin API (hq/v1/accounts/:accountId/projects) is the
// one that returns every project in the account - but it only works if
// the signed-in user actually holds account-admin rights there, and its
// account ID is the hub ID with the "b." prefix stripped.
//
// If the admin call fails (most likely: this user isn't an account admin,
// or the hub isn't an ACC/BIM 360 account at all), this falls back to the
// member-scoped list so the app still works for everyone - it just won't
// show projects they aren't a member of in that case.
router.get('/:hubId/projects', requireAuth, async (req, res) => {
  const hubId = req.params.hubId;
  const accountId = hubId.startsWith('b.') ? hubId.slice(2) : hubId;

  try {
    const accountProjects = await apsRequest(req.apsToken, {
      url: `${APS_HQ_BASE}/accounts/${accountId}/projects`,
    });

    const projects = (Array.isArray(accountProjects) ? accountProjects : []).map((p) => ({
      id: p.id?.startsWith('b.') ? p.id : `b.${p.id}`,
      name: p.name,
      status: p.status,
      startDate: p.start_date || null,
      finishDate: p.end_date || null,
    }));

    return res.json({ projects, scope: 'account-admin' });
  } catch (adminError) {
    try {
      const data = await apsRequest(req.apsToken, {
        url: `${APS_PROJECT_BASE}/hubs/${hubId}/projects`,
      });
      const projects = (data.data || []).map((p) => ({
        id: p.id,
        name: p.attributes?.name,
        status: p.attributes?.extension?.data?.status,
        startDate: p.attributes?.extension?.data?.startDate,
      }));
      return res.json({
        projects,
        scope: 'member-only',
        note: 'Showing only projects you are a member of - account-admin access was not available for this hub.',
      });
    } catch (memberError) {
      return res.status(memberError.status || 500).json({ error: memberError.message, details: memberError.details });
    }
  }
});

module.exports = router;
