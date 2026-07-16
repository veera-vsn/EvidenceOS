/**
 * `/dashboard/[workspaceSlug]/export` — draft xBRL-CSV export summary.
 *
 * Shows which documents are ready to export (latest version validated and
 * fully reviewed) and which aren't yet, before the user downloads. This
 * computation is display-only — the FastAPI export endpoint recomputes
 * the same eligibility rule server-side as the authoritative gate, so a
 * document that changes state between page load and download click can
 * never be over- or under-included.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/supabase/database.types";

interface ExportPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

interface RawDocument extends DocumentRow {
  document_versions: {
    id: string;
    version_number: number;
    extraction_results: { field_code: string }[];
    validation_results: { field_code: string }[];
    field_reviews: { field_code: string }[];
  }[];
}

type ExportStatus = "included" | "not_validated" | "incomplete_review";

interface ExportStatusDocument {
  id: string;
  name: string;
  status: ExportStatus;
  reviewedCount: number;
  totalCount: number;
}

// Mirrors the zip contents built by apps/api/app/pipeline/export.py —
// keep this list in sync if a filename changes there.
const ZIP_FILES = [
  { tag: "CSV", name: "RT_02_01_contractual_arrangements_general_info.csv", desc: "— template 1", kind: "template" as const },
  { tag: "CSV", name: "RT_02_02_contractual_arrangements_specific_info.csv", desc: "— template 2", kind: "template" as const },
  { tag: "CSV", name: "RT_05_01_ict_third-party_providers.csv", desc: "— template 3", kind: "template" as const },
  { tag: "CSV", name: "RT_06_01_functions_identification.csv", desc: "— template 4", kind: "template" as const },
  { tag: "CSV", name: "evidence_audit_trail.csv", desc: "— source, confidence & reviewer per field", kind: "audit" as const },
  { tag: "TXT", name: "disclaimer_manifest.txt", desc: "— draft-status statement", kind: "manifest" as const },
];

const ZIP_TAG_STYLES: Record<(typeof ZIP_FILES)[number]["kind"], string> = {
  template: "bg-accent-soft text-accent",
  audit: "bg-success-soft text-success",
  manifest: "bg-surface-2 text-fg-2",
};

export default async function ExportPage({ params }: ExportPageProps) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) redirect("/dashboard");

  const { data: rawDocs } = await supabase
    .from("documents")
    .select(`
      id, name, file_type, created_at, workspace_id, created_by, updated_at,
      document_versions (
        id, version_number,
        extraction_results ( field_code ),
        validation_results ( field_code ),
        field_reviews ( field_code )
      )
    `)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .returns<RawDocument[]>();

  const documents: ExportStatusDocument[] = (rawDocs ?? []).map((doc) => {
    const eligible = (doc.document_versions ?? []).filter(
      (v) => v.validation_results.length > 0,
    );

    if (eligible.length === 0) {
      return { id: doc.id, name: doc.name, status: "not_validated", reviewedCount: 0, totalCount: 0 };
    }

    const latest = eligible.reduce((a, b) => (b.version_number > a.version_number ? b : a));
    const totalCount = latest.extraction_results.length;
    const reviewedCount = new Set(latest.field_reviews.map((r) => r.field_code)).size;

    return {
      id: doc.id,
      name: doc.name,
      status: reviewedCount === totalCount ? "included" : "incomplete_review",
      reviewedCount,
      totalCount,
    };
  });

  const included = documents.filter((d) => d.status === "included");
  const excluded = documents.filter((d) => d.status !== "included");
  const zipFilename = `${workspaceSlug}-roi-draft_${new Date().toISOString().slice(0, 10)}.zip`;

  return (
    <div className="mx-auto max-w-[940px] px-5 py-6 pb-20 sm:px-10 sm:py-[34px]">
      <div className="mb-[22px]">
        <div className="font-mono text-[11px] tracking-[0.14em] text-fg-3 uppercase">
          Finish line
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-fg">
          Export the Register of Information
        </h1>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-fg-3">
          No documents yet —{" "}
          <Link href={`/dashboard/${workspaceSlug}/documents`} className="text-accent">
            upload one
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <>
          <div
            className={`overflow-hidden rounded-[14px] border bg-surface shadow-card ${
              included.length > 0 ? "border-accent-line" : "border-border"
            }`}
          >
            <div className="grid grid-cols-1 items-center gap-5 p-5 sm:gap-6 sm:p-[26px] sm:grid-cols-[1fr_auto]">
              <div>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-[32px] font-bold leading-none text-success">
                    {included.length}
                  </span>
                  <span className="text-[15px] font-medium text-fg">
                    of {documents.length} document{documents.length !== 1 ? "s" : ""} ready to export
                  </span>
                </div>
                <p className="mt-3 max-w-[440px] text-[13.5px] leading-relaxed text-fg-2">
                  A document is export-ready once all of its DORA fields have been
                  reviewed. The download bundles every ready document into the
                  regulatory template structure, with a full evidence trail attached.
                </p>
              </div>
              <div className="text-center sm:text-right">
                {included.length > 0 ? (
                  <a
                    href={`/dashboard/${workspaceSlug}/export/download`}
                    className="inline-block whitespace-nowrap rounded-[10px] bg-accent px-6 py-3.5 text-sm font-semibold text-accent-fg transition hover:opacity-90"
                  >
                    ↧ Download .zip
                  </a>
                ) : (
                  <span className="inline-block whitespace-nowrap rounded-[10px] border border-border px-6 py-3.5 text-sm font-semibold text-fg-3">
                    ↧ Download .zip
                  </span>
                )}
                <div className="mt-2 font-mono text-[10.5px] text-fg-3">
                  {included.length > 0 ? zipFilename : "nothing ready yet"}
                </div>
              </div>
            </div>

            <div className="border-t border-border-2 bg-surface-2 px-5 py-[18px] sm:px-[26px]">
              <div className="mb-3 font-mono text-[10px] tracking-[0.1em] text-fg-3 uppercase">
                What&apos;s inside the download
              </div>
              <div className="flex flex-col gap-1.5">
                {ZIP_FILES.map((z) => (
                  <div key={z.name} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
                    <span
                      className={`w-11 flex-none rounded text-center font-mono text-[9.5px] ${ZIP_TAG_STYLES[z.kind]}`}
                    >
                      {z.tag}
                    </span>
                    <span className="break-all font-mono text-fg">{z.name}</span>
                    <span className="text-xs text-fg-3">{z.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3.5 flex gap-3.5 rounded-xl border border-border bg-surface px-5 py-[17px]">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-accent-soft text-[15px] text-accent">
              §
            </span>
            <div>
              <div className="text-[13.5px] font-semibold text-fg">
                This is a structured draft for your compliance team to review.
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-2">
                EvidenceOS never submits to a regulator. A named person on your
                team makes the final filing decision — exactly as a careful
                compliance process should work. The export includes a plain-text
                disclaimer manifest recording that separation.
              </p>
            </div>
          </div>

          {excluded.length > 0 && (
            <div className="mt-[30px]">
              <div className="mb-3 flex items-baseline gap-2.5">
                <span className="text-[15px] font-semibold text-fg">Not ready yet</span>
                <span className="text-xs text-fg-3">
                  {excluded.length} document{excluded.length !== 1 ? "s" : ""} · each needs one more
                  step before it can be exported
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {excluded.map((doc) => (
                  <div
                    key={doc.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[11px] border border-border bg-surface px-[18px] py-3.5"
                  >
                    <span
                      className={`h-[9px] w-[9px] flex-none rounded-full ${
                        doc.status === "not_validated" ? "bg-fg-3" : "bg-warning"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-fg">{doc.name}</div>
                      <div
                        className={`mt-0.5 text-xs ${
                          doc.status === "not_validated" ? "text-fg-2" : "text-warning"
                        }`}
                      >
                        {doc.status === "not_validated"
                          ? "Not yet validated — run it through the Pipeline"
                          : `${doc.reviewedCount} / ${doc.totalCount} fields reviewed — finish review`}
                      </div>
                    </div>
                    <Link
                      href={
                        doc.status === "not_validated"
                          ? `/dashboard/${workspaceSlug}/pipeline`
                          : `/dashboard/${workspaceSlug}/review/${doc.id}`
                      }
                      className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-accent"
                    >
                      {doc.status === "not_validated" ? "Go to Pipeline" : "Continue review"} →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
