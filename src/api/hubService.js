import { apiClient } from './client';

export const hubService = {
  getHubs: () => apiClient.get('/api/hubs').then((d) => d.hubs || []),
  getProjects: (hubId) => apiClient.get(`/api/hubs/${hubId}/projects`).then((d) => d.projects || []),
  // Same call as getProjects but keeps the "scope"/"note" fields the backend
  // sends back, so the UI can tell the person whether they're seeing every
  // project in the hub (account-admin) or only the ones they're a member of.
  getProjectsWithScope: (hubId) =>
    apiClient.get(`/api/hubs/${hubId}/projects`).then((d) => ({ projects: d.projects || [], scope: d.scope, note: d.note })),
};
