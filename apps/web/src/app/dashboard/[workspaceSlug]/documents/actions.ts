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
 * Soft-delete a document.
 *
 * Calls the soft_delete_document() RPC rather than a plain client-side
 * `.update({ deleted_at: ... })` — PostgreSQL requires an UPDATE's
 * resulting row to also satisfy the table's SELECT policy, and
 * documents_select_member excludes rows where deleted_at is set, so a
 * direct client update can never succeed for anyone, including an owner
 * (it fails "new row violates row-level security policy" the instant
 * deleted_at stops being null). The RPC is SECURITY DEFINER and performs
 * the write as the table owner, which bypasses that check — see the
 * function's own comment in
 * supabase/migrations/0011_documents_soft_delete.sql for the full
 * explanation and precedent.
 *
 * Not a real DELETE — see Project_Docs/AUDIT_2026-07-18.md D1. Every FK
 * from documents used `on delete cascade`, so a real delete destroyed
 * document_versions, extraction_results, validation_results, and
 * field_reviews — the human review sign-off trail this product exists to
 * preserve — permanently and irrecoverably. RLS now excludes
 * deleted_at-set rows from every ordinary read, so the document
 * disappears from the app exactly as before; only the underlying
 * evidence is actually kept. Storage objects (the source PDF/DOCX/etc.)
 * are deliberately left in place too, for the same reason — the source
 * document is itself evidence.
 *
 * The database enforces who may do this (owner/admin only, via the
 * `enforce_document_soft_delete_permission()` trigger the RPC's UPDATE
 * still fires), not just this action — a member without that role gets a
 * Postgres error, not a UI-only restriction.
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

  const { error } = await supabase.rpc("soft_delete_document", {
    target_document_id: documentId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/${workspaceSlug}/documents`);
  return {};
}
