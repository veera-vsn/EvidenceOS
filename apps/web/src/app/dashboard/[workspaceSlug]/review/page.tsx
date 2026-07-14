/**
 * `/dashboard/[workspaceSlug]/review` — documents ready for human review.
 *
 * Lists each document's latest *validated* version (eligibility = at least
 * one validation_results row — deliberately bypasses pipeline_run_documents
 * / pipeline_runs entirely, since validation_results is keyed only by
 * document_version_id and upserted idempotently regardless of which run
 * produced it), with a review-progress badge, most-recently-validated
 * first. Clicking a row opens the per-document review workspace.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/supabase/database.types";

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
    .sort((a, b) => (a.lastValidatedAt < b.lastValidatedAt ? 1 : -1));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Review</h1>
        <p className="text-sm text-foreground/60">
          Approve, edit, or reject each extracted DORA field before it can be
          exported. Nothing is finalised without a human decision.
        </p>
      </section>

      {reviewable.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {reviewable.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/dashboard/${workspaceSlug}/review/${doc.id}`}
                className="flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3 hover:border-foreground/20"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{doc.name}</span>
                  <span className="font-mono text-xs uppercase text-foreground/40">
                    {doc.file_type} · validated {new Date(doc.lastValidatedAt).toLocaleString()}
                  </span>
                </div>
                <ReviewProgressBadge
                  reviewedCount={doc.reviewedCount}
                  totalCount={doc.totalCount}
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/50">
          No documents ready for review yet — validate one in{" "}
          <Link
            href={`/dashboard/${workspaceSlug}/pipeline`}
            className="underline hover:text-foreground"
          >
            Pipeline
          </Link>{" "}
          first.
        </p>
      )}
    </div>
  );
}

function ReviewProgressBadge({
  reviewedCount,
  totalCount,
}: {
  reviewedCount: number;
  totalCount: number;
}) {
  const styles =
    reviewedCount === 0
      ? "bg-foreground/10 text-foreground/60"
      : reviewedCount === totalCount
        ? "bg-success/15 text-success"
        : "bg-warning/15 text-warning";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${styles}`}>
      {reviewedCount}/{totalCount} reviewed
    </span>
  );
}
