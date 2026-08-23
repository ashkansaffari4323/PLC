import { apiClient } from './client';

export const gateService = {
  getGates: (projectId) => apiClient.get(`/api/projects/${projectId}/gates`).then((d) => d.gates || []),
  saveGates: (projectId, gates) =>
    apiClient.put(`/api/projects/${projectId}/gates`, { gates }).then((d) => d.gates || gates),
  getPhases: (projectId) => apiClient.get(`/api/projects/${projectId}/phases`).then((d) => d.phases || []),
  savePhases: (projectId, phases) =>
    apiClient.put(`/api/projects/${projectId}/phases`, { phases }).then((d) => d.phases || phases),
  getHubGates: (projectIds) =>
    apiClient
      .get('/api/hub/gates', { projectIds: projectIds.join(',') })
      .then((d) => d.projects || {}),
};
