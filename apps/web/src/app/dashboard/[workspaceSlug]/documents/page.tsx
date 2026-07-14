/**
 * `/dashboard/[workspaceSlug]/documents` — document repository.
 *
 * Lists all documents in the workspace (with their latest version status)
 * and renders the upload zone. Server Component: the list is fetched fresh
 * on each request so newly uploaded files appear after a router.refresh().
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { DocumentRow, DocumentVersionRow } from "@/lib/supabase/database.types";

import { DeleteDocumentButton } from "./delete-document-button";
import { UploadZone } from "./upload-zone";

interface DocumentsPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

/** Document row joined with its latest version for display. */
type DocumentWithVersion = DocumentRow & {
  latest_version: Pick<
    DocumentVersionRow,
    "upload_status" | "version_number" | "size_bytes"
  > | null;
};

export default async function DocumentsPage({ params }: DocumentsPageProps) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  // Fetch the workspace id for the upload zone (needs workspaceId, not slug).
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) redirect("/dashboard");

  // Fetch documents with their most recent version metadata.
  const { data: documents } = await supabase
    .from("documents")
    .select(
      `
      id, name, file_type, created_at, workspace_id, created_by, updated_at,
      document_versions (
        upload_status, version_number, size_bytes
      )
    `,
    )
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .returns<(DocumentRow & { document_versions: DocumentVersionRow[] })[]>();

  // Attach only the latest version per document.
  const docs: DocumentWithVersion[] = (documents ?? []).map((doc) => {
    const sorted = [...(doc.document_versions ?? [])].sort(
      (a, b) => b.version_number - a.version_number,
    );
    return { ...doc, latest_version: sorted[0] ?? null };
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-foreground/60">
          Upload contracts, spreadsheets, and vendor inventories to begin
          pipeline processing.
        </p>
      </section>

      <UploadZone workspaceId={workspace.id} workspaceSlug={workspaceSlug} />

      {docs.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-foreground/70">
            {docs.length} document{docs.length !== 1 ? "s" : ""}
          </h2>
          <ul className="flex flex-col gap-2">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{doc.name}</span>
                  <span className="font-mono text-xs uppercase text-foreground/40">
                    {doc.file_type}
                    {doc.latest_version?.size_bytes
                      ? ` · ${formatBytes(doc.latest_version.size_bytes)}`
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <VersionBadge
                    status={doc.latest_version?.upload_status ?? null}
                  />
                  <DeleteDocumentButton
                    documentId={doc.id}
                    workspaceSlug={workspaceSlug}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-foreground/50">
          No documents yet — upload one above to get started.
        </p>
      )}
    </div>
  );
}

function VersionBadge({
  status,
}: {
  status: DocumentVersionRow["upload_status"] | null;
}) {
  if (!status) return null;
  const styles: Record<string, string> = {
    uploaded: "bg-success/15 text-success",
    uploading: "bg-warning/15 text-warning",
    failed: "bg-danger/15 text-danger",
  };
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
