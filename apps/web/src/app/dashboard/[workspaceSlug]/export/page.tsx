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

export default async function ExportPage({ params }: ExportPageProps) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Export</h1>
        <p className="text-sm text-foreground/60">
          A structured draft for your own review — not a taxonomy-validated
          xBRL-CSV filing. You remain responsible for the final submission
          to your NCA.
        </p>
      </section>

      {documents.length > 0 ? (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-2xl font-semibold tracking-tight text-success">
                  {included.length}
                </span>
                <span className="text-xs text-foreground/50">ready to export</span>
              </div>
              <div className="h-8 w-px bg-foreground/10" />
              <div className="flex flex-col gap-0.5">
                <span className="text-2xl font-semibold tracking-tight text-foreground/60">
                  {excluded.length}
                </span>
                <span className="text-xs text-foreground/50">not yet ready</span>
              </div>
            </div>

            {included.length > 0 ? (
              <a
                href={`/dashboard/${workspaceSlug}/export/download`}
                className="self-start rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                Download export (.zip)
              </a>
            ) : (
              <p className="text-sm text-foreground/50">
                Nothing is ready to export yet — finish reviewing at least
                one document below.
              </p>
            )}
          </section>

          {excluded.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-foreground/70">Not yet ready</h2>
              <ul className="flex flex-col gap-2">
                {excluded.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3"
                  >
                    <span className="text-sm font-medium">{doc.name}</span>
                    {doc.status === "not_validated" ? (
                      <Link
                        href={`/dashboard/${workspaceSlug}/pipeline`}
                        className="text-xs text-foreground/50 underline hover:text-foreground"
                      >
                        Not yet validated — run it through Pipeline
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/${workspaceSlug}/review/${doc.id}`}
                        className="text-xs text-foreground/50 underline hover:text-foreground"
                      >
                        {doc.reviewedCount}/{doc.totalCount} fields reviewed — finish review
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="text-sm text-foreground/50">
          No documents yet —{" "}
          <Link
            href={`/dashboard/${workspaceSlug}/documents`}
            className="underline hover:text-foreground"
          >
            upload one
          </Link>{" "}
          to get started.
        </p>
      )}
    </div>
  );
}
