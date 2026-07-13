"use server";

/**
 * Server Actions for the pipeline page.
 *
 * startPipelineRun — creates a pipeline_run row (status: queued), inserts the
 * pipeline_run_documents junction rows, then calls the FastAPI trigger endpoint
 * to kick off the OCR worker in the background.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
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

  // Trigger the OCR worker in the FastAPI backend (fire-and-forget from
  // the action's perspective — the worker runs as a BackgroundTask there).
  try {
    const triggerRes = await fetch(
      `${env.API_BASE_URL}/pipeline/runs/${run.id}/trigger`,
      { method: "POST" },
    );
    if (!triggerRes.ok) {
      // Log but don't block the user — the run is queued and can be
      // manually retried or picked up by a poller later.
      console.error("Pipeline trigger failed:", await triggerRes.text());
    }
  } catch (err) {
    console.error("Pipeline trigger unreachable:", err);
  }

  revalidatePath(`/dashboard/${workspaceSlug}/pipeline`);
  return {};
}
