"use server";

/**
 * Server Actions for the document repository.
 *
 * Two-step upload protocol:
 *   1. initiateUpload  — creates document + document_version rows (status:
 *      'uploading') and returns the Storage path the browser should write to.
 *   2. confirmUpload   — called by the browser after a successful Storage
 *      upload. Marks the version as 'uploaded' and records the file size.
 *
 * Why two steps?
 *   The Storage upload goes directly from the browser to Supabase Storage
 *   (cheaper, faster, no streaming through Next.js). But we need the DB rows
 *   created first so the Storage path can embed the document and version IDs.
 *   The confirm step closes the loop: if the browser never calls it, the row
 *   stays in 'uploading' and can be cleaned up by a background job later.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { DocumentType } from "@/lib/supabase/database.types";

export interface InitiateUploadResult {
  documentId: string;
  versionId: string;
  storagePath: string;
}

/**
 * Create the document and document_version rows for a new upload.
 * Returns the storage path the browser should upload the file to.
 *
 * Storage path convention: {workspaceId}/{documentId}/1/{filename}
 * The workspace_id as the first segment is what the Storage RLS policy
 * reads to verify membership.
 */
export async function initiateUpload(
  workspaceId: string,
  filename: string,
  fileType: DocumentType,
): Promise<InitiateUploadResult | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Create the logical document.
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({ workspace_id: workspaceId, name: filename, file_type: fileType, created_by: user.id })
    .select("id")
    .single();

  if (docError || !doc) {
    return { error: docError?.message ?? "Failed to create document record." };
  }

  // Sanitise the filename for Storage: keep only alphanumerics, dots, dashes,
  // underscores, and spaces. Collapse repeated spaces.
  const safeFilename = filename
    .replace(/[^a-zA-Z0-9.\-_ ]/g, "_")
    .replace(/\s+/g, "_");

  const storagePath = `${workspaceId}/${doc.id}/1/${safeFilename}`;

  // Create the version row in 'uploading' state.
  const { data: version, error: versionError } = await supabase
    .from("document_versions")
    .insert({
      document_id: doc.id,
      version_number: 1,
      storage_path: storagePath,
      uploaded_by: user.id,
      upload_status: "uploading",
    })
    .select("id")
    .single();

  if (versionError || !version) {
    return { error: versionError?.message ?? "Failed to create version record." };
  }

  return {
    documentId: doc.id,
    versionId: version.id,
    storagePath,
  };
}

/**
 * Mark a document_version as successfully uploaded.
 * Called by the browser after it has confirmed the Storage upload completed.
 */
export async function confirmUpload(
  versionId: string,
  sizeBytes: number,
  workspaceSlug: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("document_versions")
    .update({ upload_status: "uploaded", size_bytes: sizeBytes })
    .eq("id", versionId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/${workspaceSlug}/documents`);
  return {};
}

/**
 * Mark a document_version as failed (e.g. Storage upload error).
 */
export async function failUpload(
  versionId: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("document_versions")
    .update({ upload_status: "failed" })
    .eq("id", versionId);
}

/**
 * Delete a document and all associated data.
 *
 * Order of operations:
 *   1. Fetch all version storage paths so we can remove the files.
 *   2. Delete Storage objects (best-effort — DB delete proceeds even if
 *      Storage removal partially fails; orphaned files are harmless).
 *   3. Delete the documents row — cascades to document_versions,
 *      pipeline_run_documents, document_text, and extraction_results.
 */
export async function deleteDocument(
  documentId: string,
  workspaceSlug: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch storage paths for all versions of this document.
  const { data: versions } = await supabase
    .from("document_versions")
    .select("storage_path")
    .eq("document_id", documentId);

  const paths = (versions ?? []).map((v) => v.storage_path).filter(Boolean);

  if (paths.length > 0) {
    await supabase.storage.from("documents").remove(paths);
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/${workspaceSlug}/documents`);
  return {};
}
