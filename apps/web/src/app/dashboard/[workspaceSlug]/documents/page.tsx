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

import { PaginationNav } from "../_components/pagination-nav";
import { DeleteDocumentButton } from "./delete-document-button";
import { UploadZone } from "./upload-zone";

const PAGE_SIZE = 25;

interface DocumentsPageProps {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}

/** Document row joined with its latest version for display. */
type DocumentWithVersion = DocumentRow & {
  latest_version: Pick<
    DocumentVersionRow,
    "upload_status" | "version_number" | "size_bytes"
  > | null;
};

export default async function DocumentsPage({ params, searchParams }: DocumentsPageProps) {
  const { workspaceSlug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Fetch the workspace id for the upload zone (needs workspaceId, not slug).
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) redirect("/dashboard");

  // Fetch documents with their most recent version metadata, one page at a
  // time -- an unbounded fetch here is exactly the scaling problem flagged
  // in Project_Docs/AUDIT_2026-07-18.md's A5 (a product designed to
  // accumulate evidence over time was fetching every row on every load).
  const { count: totalCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

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
    .range(from, to)
    .returns<(DocumentRow & { document_versions: DocumentVersionRow[] })[]>();

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  // Attach only the latest version per document.
  const docs: DocumentWithVersion[] = (documents ?? []).map((doc) => {
    const sorted = [...(doc.document_versions ?? [])].sort(
      (a, b) => b.version_number - a.version_number,
    );
    return { ...doc, latest_version: sorted[0] ?? null };
  });

  return (
    <div className="mx-auto max-w-[1040px] px-5 py-6 pb-20 sm:px-10 sm:py-[34px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2 sm:mb-6">
        <div>
          <div className="font-mono text-[11px] tracking-[0.14em] text-fg-3 uppercase">
            Repository
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-fg">
            Documents
          </h1>
        </div>
        <div className="text-[13px] text-fg-2">
          <strong className="font-semibold text-fg">{totalCount ?? 0}</strong> ICT
          vendor contract{(totalCount ?? 0) !== 1 ? "s" : ""}
        </div>
      </div>

      <UploadZone workspaceId={workspace.id} workspaceSlug={workspaceSlug} />

      {docs.length > 0 ? (
        <div className="mt-6 sm:mt-8">
          <div className="hidden border-b border-border-2 px-3.5 pb-2.5 font-mono text-[10.5px] tracking-[0.08em] text-fg-3 uppercase sm:grid sm:grid-cols-[1fr_90px_90px_130px_40px] sm:gap-3">
            <span>Document</span>
            <span>Type</span>
            <span>Size</span>
            <span>Status</span>
            <span />
          </div>
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-1.5 border-b border-border-2 px-3.5 py-3 sm:grid sm:grid-cols-[1fr_90px_90px_130px_40px] sm:items-center sm:gap-3 sm:py-3.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex-none rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-fg-3">
                  {doc.file_type.toUpperCase()}
                </span>
                <span className="truncate text-[13.5px] font-medium text-fg">{doc.name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:contents">
                <span className="text-[12px] text-fg-2 sm:text-[12.5px]">{doc.file_type}</span>
                <span className="font-mono text-[12px] text-fg-2 sm:text-[12.5px]">
                  {doc.latest_version?.size_bytes ? formatBytes(doc.latest_version.size_bytes) : "—"}
                </span>
                <VersionBadge status={doc.latest_version?.upload_status ?? null} />
              </div>
              <div className="flex justify-end sm:contents">
                <DeleteDocumentButton
                  documentId={doc.id}
                  documentName={doc.name}
                  workspaceSlug={workspaceSlug}
                />
              </div>
            </div>
          ))}

          <PaginationNav
            page={page}
            totalPages={totalPages}
            basePath={`/dashboard/${workspaceSlug}/documents`}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-fg-3">
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
  if (!status) return <span />;
  const styles: Record<string, string> = {
    uploaded: "bg-success-soft text-success",
    uploading: "bg-accent-soft text-accent",
    failed: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold capitalize ${styles[status] ?? ""}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
