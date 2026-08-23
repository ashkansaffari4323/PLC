import { apiClient } from './client';

export const hubService = {
  getHubs: () => apiClient.get('/api/hubs').then((d) => d.hubs || []),
  getProjects: (hubId) => apiClient.get(`/api/hubs/${hubId}/projects`).then((d) => d.projects || []),
};
