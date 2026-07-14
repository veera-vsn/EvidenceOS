/**
 * Workspace role lookups.
 *
 * RLS is the real enforcement boundary for who can write what (see
 * `field_reviews` policies in migration 0009) — nothing here is a security
 * control. This only tells the UI whether to *offer* a control that would
 * actually succeed, so a viewer isn't shown buttons that silently fail.
 */

import type { createClient } from "./server";
import type { WorkspaceRole } from "./database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** The current user's role in a workspace, or null if not a member. */
export async function getCurrentWorkspaceRole(
  supabase: SupabaseServerClient,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceRole | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();
  return data?.role ?? null;
}

/** True for roles allowed to write field_reviews. */
export function canReviewFields(role: WorkspaceRole | null): boolean {
  return role === "reviewer" || role === "admin" || role === "owner";
}
