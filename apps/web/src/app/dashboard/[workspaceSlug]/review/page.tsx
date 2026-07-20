/**
 * `/dashboard/[workspaceSlug]/review` — documents ready for human review.
 *
 * Lists each document's latest *validated* version (eligibility = at least
 * one validation_results row — deliberately bypasses pipeline_run_documents
 * / pipeline_runs entirely, since validation_results is keyed only by
 * document_version_id and upserted idempotently regardless of which run
 * produced it), with a review-progress ring, most-recently-validated
 * first. Clicking a row opens the per-document review workspace.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/supabase/database.types";
import { EmptyState } from "@/components/ui/empty-state";

interface ReviewListPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

interface RawDocument extends DocumentRow {
  document_versions: {
    id: string;
    version_number: number;
    extraction_results: { field_code: string }[];
    validation_results: { field_code: string; validated_at: string }[];
    field_reviews: { field_code: string }[];
  }[];
}

interface ReviewableDocument {
  id: string;
  name: string;
  file_type: string;
  lastValidatedAt: string;
  reviewedCount: number;
  totalCount: number;
}

export default async function ReviewListPage({ params }: ReviewListPageProps) {
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
        validation_results ( field_code, validated_at ),
        field_reviews ( field_code )
      )
    `)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .returns<RawDocument[]>();

  const reviewable: ReviewableDocument[] = (rawDocs ?? [])
    .map((doc): ReviewableDocument | null => {
      const eligible = (doc.document_versions ?? []).filter(
        (v) => v.validation_results.length > 0,
      );
      if (eligible.length === 0) return null;

      const latest = eligible.reduce((a, b) =>
        b.version_number > a.version_number ? b : a,
      );
      const lastValidatedAt = latest.validation_results.reduce(
        (max, v) => (v.validated_at > max ? v.validated_at : max),
        latest.validation_results[0]!.validated_at,
      );

      return {
        id: doc.id,
        name: doc.name,
        file_type: doc.file_type,
        lastValidatedAt,
        reviewedCount: new Set(latest.field_reviews.map((r) => r.field_code)).size,
        totalCount: latest.extraction_results.length,
      };
    })
    .filter((d): d is ReviewableDocument => d !== null)
    .sort((a, b) => {
      // Needs attention first: not-started and in-progress ahead of fully
      // reviewed, then most-recently-validated within each group.
      const aDone = a.reviewedCount >= a.totalCount;
      const bDone = b.reviewedCount >= b.totalCount;
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.lastValidatedAt < b.lastValidatedAt ? 1 : -1;
    });

  const totalFieldsAwaiting = reviewable.reduce(
    (sum, d) => sum + Math.max(0, d.totalCount - d.reviewedCount),
    0,
  );
  const fullyReviewedCount = reviewable.filter((d) => d.reviewedCount >= d.totalCount).length;

  return (
    <div className="mx-auto max-w-[1160px] px-5 py-6 pb-20 sm:px-10 sm:py-[34px]">
      <div className="mb-2">
        <div className="font-mono text-[11px] tracking-[0.14em] text-fg-3 uppercase">
          Human-in-the-loop
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-fg">
          Review queue
        </h1>
      </div>
      <p className="mb-[22px] max-w-lg text-sm text-fg-2">
        Every AI-extracted field must be approved, corrected or rejected
        before its document can be exported. Work top-down — items needing
        attention are surfaced first.
      </p>

      {reviewable.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-[11px] border border-border bg-surface px-[17px] py-[15px]">
            <div className="text-xl font-semibold text-fg">{reviewable.length}</div>
            <div className="mt-0.5 text-xs text-fg-2">documents in queue</div>
          </div>
          <div className="rounded-[11px] border border-border bg-surface px-[17px] py-[15px]">
            <div className="text-xl font-semibold text-warning">{totalFieldsAwaiting}</div>
            <div className="mt-0.5 text-xs text-fg-2">fields awaiting your decision</div>
          </div>
          <div className="rounded-[11px] border border-border bg-surface px-[17px] py-[15px]">
            <div className="text-xl font-semibold text-success">{fullyReviewedCount}</div>
            <div className="mt-0.5 text-xs text-fg-2">fully reviewed, ready to export</div>
          </div>
        </div>
      )}

      {reviewable.length > 0 ? (
        <>
          <div className="mb-2.5 font-mono text-[10.5px] tracking-[0.1em] text-fg-3 uppercase">
            Ordered by attention needed
          </div>
          <ul className="flex flex-col gap-2">
            {reviewable.map((doc) => (
              <li key={doc.id}>
                <ReviewRow workspaceSlug={workspaceSlug} doc={doc} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState
          icon="✓"
          title="Nothing to review yet"
          description="Run a document through the Pipeline first — it'll show up here once it's validated."
          action={{ label: "Go to Pipeline", href: `/dashboard/${workspaceSlug}/pipeline` }}
        />
      )}
    </div>
  );
}

function ReviewRow({
  workspaceSlug,
  doc,
}: {
  workspaceSlug: string;
  doc: ReviewableDocument;
}) {
  const { ring, stage, cta } = ringMeta(doc.reviewedCount, doc.totalCount);
  const pct = doc.totalCount === 0 ? 0 : (doc.reviewedCount / doc.totalCount) * 100;

  return (
    <Link
      href={`/dashboard/${workspaceSlug}/review/${doc.id}`}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-border bg-surface px-[18px] py-[15px] shadow-card hover:border-accent-line"
    >
      <div className="flex w-[66px] flex-col items-center gap-1.5">
        <div className="relative h-11 w-11">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(${ring} ${pct * 3.6}deg, var(--border-2) 0)`,
            }}
          />
          <div
            className="absolute inset-[5px] flex items-center justify-center rounded-full bg-surface font-mono text-[11px] font-semibold"
            style={{ color: ring }}
          >
            {doc.reviewedCount}/{doc.totalCount}
          </div>
        </div>
        <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: ring }}>
          {stage}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="flex-none rounded border border-border px-1.5 py-0.5 font-mono text-[9.5px] text-fg-3">
            {doc.file_type.toUpperCase()}
          </span>
          <span className="truncate text-[14.5px] font-semibold text-fg">{doc.name}</span>
        </div>
        <div className="mt-1 text-xs text-fg-3">
          Last validated {new Date(doc.lastValidatedAt).toLocaleString()}
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent">
        {cta} <span className="text-[15px]">→</span>
      </span>
    </Link>
  );
}

function ringMeta(reviewed: number, total: number): { ring: string; stage: string; cta: string } {
  if (reviewed === 0) return { ring: "var(--fg-3)", stage: "not started", cta: "Start review" };
  if (total > 0 && reviewed >= total) return { ring: "var(--success)", stage: "complete", cta: "View" };
  return { ring: "var(--warning)", stage: "in progress", cta: "Continue" };
}
