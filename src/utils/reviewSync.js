// src/utils/reviewSync.js
//
// Centralizes "go ask ACC how each review is doing and fold that back into
// our gate data" so every screen that shows gate status (GateManager,
// ProjectDashboard, HubDashboard) reads the same live-synced data instead
// of each maintaining its own copy of this logic.

import { reviewService } from '../api/reviewService';
import { gateService } from '../api/gateService';

/**
 * Turns a GET /reviews/:reviewId response into one of our statuses.
 * Confirmed against Autodesk's official reference: a review's `status` is
 * one of OPEN / CLOSED / VOID / FAILED - it does NOT directly say
 * approved/rejected. Final outcome is read from `approvedBy`, which the
 * docs state is "an empty object if the review has not yet been
 * final-approved" - so a CLOSED review with a populated approvedBy was
 * approved; CLOSED with an empty approvedBy was rejected (sent back
 * without final approval). VOID/FAILED are treated as rejected so they
 * don't silently unlock a gate.
 */
export function deriveReviewStatus(review) {
  const status = review?.status;
  if (status === 'OPEN') return 'in-progress';
  if (status === 'VOID' || status === 'FAILED') return 'rejected';
  if (status === 'CLOSED') {
    const approved = review?.approvedBy && Object.keys(review.approvedBy).length > 0;
    return approved ? 'approved' : 'rejected';
  }
  return 'in-progress';
}

/**
 * Pulls both the derived status and the raw `nextActionBy` (who's
 * responsible for the current step - claimedBy plus remaining candidates)
 * out of a review response. `nextActionBy` is only meaningful while a
 * review is OPEN; once closed there's no "next" action left.
 */
export function extractReviewInfo(review) {
  return {
    status: deriveReviewStatus(review),
    nextActionBy: review?.status === 'OPEN' ? review?.nextActionBy || null : null,
  };
}

/** Fetches live status + reviewer info for one review, returning null if it can't be checked right now. */
export async function fetchLiveReviewInfo(projectId, reviewId) {
  try {
    const review = await reviewService.getReview(projectId, reviewId);
    return extractReviewInfo(review);
  } catch {
    return null;
  }
}

/**
 * Turns a review's `nextActionBy` into a flat list of human-readable
 * names - the people (or, failing that, roles/companies) still on the
 * hook for the current step. Prefers named users; falls back to roles or
 * companies when no individual has been assigned yet.
 */
export function getReviewerNames(nextActionBy) {
  if (!nextActionBy) return [];
  const candidates = nextActionBy.candidates || {};
  const users = (candidates.users || []).map((u) => u.name).filter(Boolean);
  if (users.length > 0) return users;
  const roles = (candidates.roles || []).map((r) => r.name).filter(Boolean);
  if (roles.length > 0) return roles;
  return (candidates.companies || []).map((c) => c.name).filter(Boolean);
}

/** The most recent submission for a criterion, or null if it's never been sent for review. */
export function getLatestSubmission(criterion) {
  const subs = criterion?.submissions || [];
  return subs.length > 0 ? subs[subs.length - 1] : null;
}

/**
 * Scans every gate in a project for criteria still in progress and
 * collects who's still responsible and which files are waiting - used by
 * both the project and hub dashboards so "what's blocking this" reads the
 * same way everywhere.
 */
export function getPendingReviewInfo(gates) {
  const reviewers = new Set();
  const files = new Set();

  (gates || []).forEach((gate) => {
    (gate.criteria || []).forEach((c) => {
      if (c.reviewStatus !== 'in-progress') return;
      getReviewerNames(c.nextActionBy).forEach((name) => reviewers.add(name));
      const submission = getLatestSubmission(c);
      (submission?.documents || []).forEach((doc) => files.add(doc.name));
    });
  });

  return { reviewers: [...reviewers], files: [...files] };
}

/** Re-syncs every criterion with a reviewId attached, across every gate, and returns the updated array (does not persist). */
export async function syncAllGates(projectId, gates) {
  return Promise.all(
    gates.map(async (gate) => {
      const criteria = gate.criteria || [];
      const hasReviews = criteria.some((c) => c.reviewId);
      if (!hasReviews) return gate;

      const updatedCriteria = await Promise.all(
        criteria.map(async (c) => {
          if (!c.reviewId) return c;
          const info = await fetchLiveReviewInfo(projectId, c.reviewId);
          if (!info) return c;
          return { ...c, reviewStatus: info.status, nextActionBy: info.nextActionBy };
        })
      );
      return { ...gate, criteria: updatedCriteria };
    })
  );
}

/** Syncs and persists in one step - the common case for a "refresh" button. */
export async function syncAndSaveGates(projectId, gates) {
  const updated = await syncAllGates(projectId, gates);
  await gateService.saveGates(projectId, updated);
  return updated;
}
