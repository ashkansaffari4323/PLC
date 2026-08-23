const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { apsRequest, APS_PROJECT_BASE, APS_DM_BASE } = require('../apsClient');

const router = express.Router();

// Top-level folders (e.g. "Project Files", "Plans") for a project.
router.get('/hubs/:hubId/projects/:projectId/top-folders', requireAuth, async (req, res) => {
  try {
    const data = await apsRequest(req.apsToken, {
      url: `${APS_PROJECT_BASE}/hubs/${req.params.hubId}/projects/${req.params.projectId}/topFolders`,
    });
    const folders = (data.data || []).map((f) => ({
      id: f.id,
      name: f.attributes?.displayName || f.attributes?.name,
      type: 'folder',
    }));
    res.json({ folders });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
});

// Contents (subfolders + files) of a given folder.
router.get('/projects/:projectId/folders/:folderId/contents', requireAuth, async (req, res) => {
  try {
    const data = await apsRequest(req.apsToken, {
      url: `${APS_DM_BASE}/projects/${req.params.projectId}/folders/${req.params.folderId}/contents`,
    });

    const items = (data.data || []).map((item) => ({
      id: item.id,
      name: item.attributes?.displayName || item.attributes?.name,
      type: item.type === 'folders' ? 'folder' : 'file',
      lastModified: item.attributes?.lastModifiedTime,
      createTime: item.attributes?.createTime,
    }));

    res.json({ items });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
});

// A file's current ("tip") version - needed when attaching a document to a
// review, since reviews reference a specific version, not just the item.
router.get('/projects/:projectId/items/:itemId', requireAuth, async (req, res) => {
  try {
    const data = await apsRequest(req.apsToken, {
      url: `${APS_DM_BASE}/projects/${req.params.projectId}/items/${req.params.itemId}`,
    });

    const item = data.data;
    const tipVersionId = item?.relationships?.tip?.data?.id || null;

    res.json({
      id: item?.id,
      name: item?.attributes?.displayName || item?.attributes?.name,
      tipVersionId,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
});

module.exports = router;
