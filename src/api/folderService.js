import { apiClient } from './client';

export const folderService = {
  getTopFolders: (hubId, projectId) =>
    apiClient.get(`/api/hubs/${hubId}/projects/${projectId}/top-folders`).then((d) => d.folders || []),
  getFolderContents: (projectId, folderId) =>
    apiClient.get(`/api/projects/${projectId}/folders/${folderId}/contents`).then((d) => d.items || []),
  getItem: (projectId, itemId) => apiClient.get(`/api/projects/${projectId}/items/${itemId}`),
};
