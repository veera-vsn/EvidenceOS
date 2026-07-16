"use server";

/**
 * Server Actions for the entity profile settings page (Full RoI Stage 2B).
 *
 * No AI extraction and no field_reviews-style approve/edit/reject here —
 * this is user-entered settings data, so validation happens directly in
 * these actions (LEI shape, entity type is one of the real 22 EBA values,
 * required fields) rather than through validator.py's rule engine, which
 * exists for AI-extracted document fields with confidence scores, not this.
 *
 * RLS (migration 0010) is the real enforcement boundary for who can write
 * — canEditEntityProfile only controls what the UI *offers*, same
 * relationship documented in workspace-role.ts.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { ENTITY_TYPES } from "./entity-types";

const LEI_PATTERN = /^[A-Z0-9]{20}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

export interface EntityProfileInput {
  lei: string;
  name: string;
  country: string;
  entityType: string;
  competentAuthority: string;
  totalAssets: string;
  totalAssetsCurrency: string;
}

function validateProfileInput(input: EntityProfileInput): string | null {
  const lei = input.lei.trim().toUpperCase();
  if (!LEI_PATTERN.test(lei)) {
    return "LEI must be 20 alphanumeric characters.";
  }
  if (!input.name.trim()) {
    return "Name is required.";
  }
  const country = input.country.trim().toUpperCase();
  if (!COUNTRY_PATTERN.test(country)) {
    return "Country must be a 2-letter ISO code (e.g. IE).";
  }
  if (!ENTITY_TYPES.includes(input.entityType as (typeof ENTITY_TYPES)[number])) {
    return "Select a recognised entity type.";
  }
  if (!input.competentAuthority.trim()) {
    return "Competent authority is required.";
  }
  if (input.totalAssets.trim() && Number.isNaN(Number(input.totalAssets))) {
    return "Total assets must be a number.";
  }
  if (input.totalAssetsCurrency.trim() && !/^[A-Z]{3}$/.test(input.totalAssetsCurrency.trim().toUpperCase())) {
    return "Currency must be a 3-letter code (e.g. EUR).";
  }
  return null;
}

/** Create or update the workspace's one entity profile (upsert on the
 * unique workspace_id constraint from migration 0010). */
export async function saveEntityProfile(
  workspaceId: string,
  workspaceSlug: string,
  input: EntityProfileInput,
): Promise<{ error?: string }> {
  const validationError = validateProfileInput(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("entity_profiles").upsert(
    {
      workspace_id: workspaceId,
      lei: input.lei.trim().toUpperCase(),
      name: input.name.trim(),
      country: input.country.trim().toUpperCase(),
      entity_type: input.entityType,
      competent_authority: input.competentAuthority.trim(),
      total_assets: input.totalAssets.trim() ? Number(input.totalAssets) : null,
      total_assets_currency: input.totalAssetsCurrency.trim()
        ? input.totalAssetsCurrency.trim().toUpperCase()
        : null,
      created_by: user.id,
    },
    { onConflict: "workspace_id" },
  );

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/${workspaceSlug}/settings`);
  return {};
}

export interface BranchInput {
  branchCode: string;
  name: string;
  country: string;
}

export async function addBranch(
  workspaceId: string,
  workspaceSlug: string,
  input: BranchInput,
): Promise<{ error?: string }> {
  if (!input.branchCode.trim() || !input.name.trim()) {
    return { error: "Branch code and name are required." };
  }
  const country = input.country.trim().toUpperCase();
  if (!COUNTRY_PATTERN.test(country)) {
    return { error: "Country must be a 2-letter ISO code (e.g. IE)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("entity_branches").insert({
    workspace_id: workspaceId,
    branch_code: input.branchCode.trim(),
    name: input.name.trim(),
    country,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/${workspaceSlug}/settings`);
  return {};
}

export async function removeBranch(
  branchId: string,
  workspaceSlug: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("entity_branches").delete().eq("id", branchId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/${workspaceSlug}/settings`);
  return {};
}
