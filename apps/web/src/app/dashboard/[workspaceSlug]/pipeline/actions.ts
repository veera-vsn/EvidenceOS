"use server";

/**
 * Server Actions for the pipeline page.
 *
 * startPipelineRun — creates a pipeline_run row (status: queued) and the
 * corresponding pipeline_run_documents rows for each selected document
 * version. Workers will pick up the run and update stage statuses.
 *
 * For Phase 1 the "worker" does not exist yet — this action gets the
 * data model right so Phase 2 can plug the OCR worker in without any
 * schema changes.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function startPipelineRun(
  workspaceId: string,
  workspaceSlug: string,
  documentVersionIds: string[],
): Promise<{ error?: string }> {
  if (documentVersionIds.length === 0) {
    return { error: "Select at least one document to process." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Create the pipeline run.
  const { data: run, error: runError } = await supabase
    .from("pipeline_runs")
    .insert({ workspace_id: workspaceId, created_by: user.id, status: "queued" })
    .select("id")
    .single();

  if (runError || !run) {
    return { error: runError?.message ?? "Failed to create pipeline run." };
  }

  // Add the selected versions to the run.
  const docs = documentVersionIds.map((vid) => ({
    pipeline_run_id: run.id,
    document_version_id: vid,
  }));

  const { error: docsError } = await supabase
    .from("pipeline_run_documents")
    .insert(docs);

  if (docsError) {
    return { error: docsError.message };
  }

  revalidatePath(`/dashboard/${workspaceSlug}/pipeline`);
  return {};
}
