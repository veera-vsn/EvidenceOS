/**
 * `/dashboard/[workspaceSlug]/settings` — the filer's own entity profile.
 *
 * Full RoI Stage 2B (Phase 11): the first workspace-settings page in this
 * app, and deliberately not part of the document pipeline — entity_profiles
 * has no confidence score, no field_reviews-style approve/edit/reject,
 * because there is nothing to extract. This is the filer's own identity,
 * entered once and reused across every export for EBA tables
 * B_01.01/B_01.02/B_01.03 and the B_03.01/B_03.02/B_04.01 rows derived
 * from it (see apps/api/app/pipeline/entity_export.py).
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canEditEntityProfile, getCurrentWorkspaceRole } from "@/lib/supabase/workspace-role";
import type { EntityBranchRow, EntityProfileRow } from "@/lib/supabase/database.types";

import { EntityProfileForm } from "./entity-profile-form";

interface SettingsPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) redirect("/dashboard");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user ? await getCurrentWorkspaceRole(supabase, workspace.id, user.id) : null;
  const canEdit = canEditEntityProfile(role);

  const [{ data: profile }, { data: branches }] = await Promise.all([
    supabase
      .from("entity_profiles")
      .select(
        "id, lei, name, country, entity_type, competent_authority, total_assets, total_assets_currency",
      )
      .eq("workspace_id", workspace.id)
      .maybeSingle<EntityProfileRow>(),
    supabase
      .from("entity_branches")
      .select("id, branch_code, name, country")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true })
      .returns<EntityBranchRow[]>(),
  ]);

  return (
    <div className="mx-auto max-w-[880px] px-5 py-6 pb-20 sm:px-10 sm:py-[34px]">
      <div className="mb-6">
        <div className="font-mono text-[11px] tracking-[0.14em] text-fg-3 uppercase">
          Workspace settings
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-fg">Entity profile</h1>
        <p className="mt-2 max-w-lg text-sm text-fg-2">
          Your own organisation&apos;s identity — entered once, reused for every export.
          This is not extracted from a document and has no reviewer approval step; it
          feeds EBA tables B_01.01, B_01.02, B_01.03, and the signing-entity rows
          derived from them (B_03.01 / B_03.02 / B_04.01).
        </p>
      </div>

      <EntityProfileForm
        workspaceId={workspace.id}
        workspaceSlug={workspaceSlug}
        profile={profile ?? null}
        branches={branches ?? []}
        canEdit={canEdit}
      />
    </div>
  );
}
