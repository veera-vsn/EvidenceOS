/**
 * Pure helpers for the review pages.
 *
 * Deliberately kept out of `actions.ts` — every export of a `"use server"`
 * file must be async (Resolution 002), so sync helpers live here instead.
 */

import type { ReviewDecision } from "@/lib/supabase/database.types";

export function reviewDecisionLabel(decision: ReviewDecision): string {
  const labels: Record<ReviewDecision, string> = {
    approved: "Approved",
    edited: "Edited",
    rejected: "Rejected",
  };
  return labels[decision];
}

export interface ReviewProgress {
  reviewedCount: number;
  totalCount: number;
  percent: number;
}

export function computeReviewProgress(
  reviewedCount: number,
  totalCount: number,
): ReviewProgress {
  return {
    reviewedCount,
    totalCount,
    percent: totalCount === 0 ? 0 : Math.round((reviewedCount / totalCount) * 100),
  };
}
