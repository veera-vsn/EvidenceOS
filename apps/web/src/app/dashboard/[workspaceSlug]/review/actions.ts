"use server";

/**
 * Server Action for the review pages.
 *
 * submitFieldReview — upserts a field_reviews row, then awaits a call to
 * the FastAPI revalidate endpoint so validation_results reflects the
 * decision (in particular, an edited value) before the page re-renders.
 * Unlike startPipelineRun's fire-and-forget trigger call, this one is
 * awaited: the UI needs the refreshed validation badges immediately, not
 * eventually.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { internalApiHeaders } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export type ReviewSubmission =
  | { decision: "approved" }
  | { decision: "edited"; editedValue: string }
  | { decision: "rejected"; notes: string };

export async function submitFieldReview(
  documentVersionId: string,
  fieldCode: string,
  documentId: string,
  workspaceSlug: string,
  submission: ReviewSubmission,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error: upsertError } = await supabase.from("field_reviews").upsert(
    {
      document_version_id: documentVersionId,
      field_code: fieldCode,
      decision: submission.decision,
      edited_value: submission.decision === "edited" ? submission.editedValue : null,
      notes: submission.decision === "rejected" ? submission.notes : null,
      reviewed_by: user.id,
    },
    { onConflict: "document_version_id,field_code" },
  );

  if (upsertError) return { error: upsertError.message };

  try {
    const res = await fetch(
      `${env.API_BASE_URL}/pipeline/documents/${documentVersionId}/revalidate`,
      { method: "POST", headers: internalApiHeaders() },
    );
    if (!res.ok) {
      return { error: `Review saved, but re-validation failed: ${await res.text()}` };
    }
  } catch (err) {
    return { error: `Review saved, but re-validation is unreachable: ${String(err)}` };
  }

  revalidatePath(`/dashboard/${workspaceSlug}/review/${documentId}`);
  revalidatePath(`/dashboard/${workspaceSlug}/review`);
  return {};
}
