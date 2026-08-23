import { apiClient } from './client';

export const reviewService = {
  getWorkflows: (projectId) =>
    apiClient.get(`/api/projects/${projectId}/workflows`).then((d) => d.workflows || []),
  getReviews: (projectId) =>
    apiClient.get(`/api/projects/${projectId}/reviews`).then((d) => d.reviews || []),
  createReview: (projectId, payload) => apiClient.post(`/api/projects/${projectId}/reviews`, payload),
  getReview: (projectId, reviewId) => apiClient.get(`/api/projects/${projectId}/reviews/${reviewId}`),
  getReviewProgress: (projectId, reviewId) =>
    apiClient.get(`/api/projects/${projectId}/reviews/${reviewId}/progress`),
};
