/**
 * `/dashboard/[workspaceSlug]/review/[documentId]` — per-document review
 * workspace.
 *
 * Shows the document's latest validated version, grouped into the ESMA
 * template sections, with one FieldReviewCard per DORA field. Any field
 * code that doesn't match a current group (e.g. a stale code left over
 * from a previous catalogue version — see dora-field-groups.ts) renders
 * under a final "Other" section rather than silently vanishing. The only
 * Client Components on this page are the cards themselves (each owns its
 * own approve/edit/reject state) and `ReviewKeyboardShortcuts`, which
 * drives the A/E/R/↓ shortcuts advertised in the header.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { decryptText } from "@/lib/crypto/document-encryption";
import { canReviewFields, getCurrentWorkspaceRole } from "@/lib/supabase/workspace-role";
import type {
  ExtractionResultRow,
  FieldReviewRow,
  ValidationResultRow,
} from "@/lib/supabase/database.types";

import { DORA_FIELD_GROUPS, OTHER_GROUP, groupForFieldCode } from "../dora-field-groups";
import { computeReviewProgress } from "../review-utils";
import { FieldReviewCard } from "../field-review-card";
import { ReviewKeyboardShortcuts } from "../keyboard-shortcuts";

interface ReviewDetailPageProps {
  params: Promise<{ workspaceSlug: string; documentId: string }>;
}

interface RawDocument {
  id: string;
  name: string;
  workspace_id: string;
  document_versions: {
    id: string;
    version_number: number;
    extraction_results: Pick<
      ExtractionResultRow,
      "field_code" | "field_label" | "extracted_value" | "confidence"
    >[];
    validation_results: Pick<
      ValidationResultRow,
      "field_code" | "rule_id" | "rule_label" | "status" | "message"
    >[];
    field_reviews: Pick<FieldReviewRow, "field_code" | "decision" | "edited_value" | "notes">[];
  }[];
}

export default async function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  const { workspaceSlug, documentId } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) redirect("/dashboard");

  const { data: doc } = await supabase
    .from("documents")
    .select(`
      id, name, workspace_id,
      document_versions (
        id, version_number,
        extraction_results ( field_code, field_label, extracted_value, confidence ),
        validation_results ( field_code, rule_id, rule_label, status, message ),
        field_reviews ( field_code, decision, edited_value, notes )
      )
    `)
    .eq("id", documentId)
    .eq("workspace_id", workspace.id)
    .single<RawDocument>();

  if (!doc) redirect(`/dashboard/${workspaceSlug}/review`);

  // extraction_results.extracted_value is encrypted at rest (see
  // app/core/encryption.py) -- decrypt before anything below reads it.
  for (const v of doc.document_versions ?? []) {
    v.extraction_results = v.extraction_results.map((f) => ({
      ...f,
      extracted_value: decryptText(f.extracted_value),
    }));
  }

  const eligible = (doc.document_versions ?? []).filter(
    (v) => v.validation_results.length > 0,
  );
  if (eligible.length === 0) redirect(`/dashboard/${workspaceSlug}/review`);

  const version = eligible.reduce((a, b) => (b.version_number > a.version_number ? b : a));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user
    ? await getCurrentWorkspaceRole(supabase, workspace.id, user.id)
    : null;
  const canReview = canReviewFields(role);

  const reviewByField = new Map(version.field_reviews.map((r) => [r.field_code, r]));
  const validationByField = new Map<string, typeof version.validation_results>();
  for (const v of version.validation_results) {
    const list = validationByField.get(v.field_code) ?? [];
    list.push(v);
    validationByField.set(v.field_code, list);
  }

  const progress = computeReviewProgress(reviewByField.size, version.extraction_results.length);
  const isComplete = progress.reviewedCount >= progress.totalCount && progress.totalCount > 0;
  const orderedFieldCodes = version.extraction_results.map((f) => f.field_code);

  return (
    <div className="mx-auto max-w-[920px]">
      {canReview && <ReviewKeyboardShortcuts fieldCodes={orderedFieldCodes} />}

      <div className="sticky top-0 z-10 border-b border-border-2 bg-bg px-5 pt-4 pb-4 sm:px-10 sm:pt-[22px]">
        <Link href={`/dashboard/${workspaceSlug}/review`} className="text-[12.5px] text-fg-2">
          ← Review queue
        </Link>
        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-fg">{doc.name}</h1>
            <div className="mt-1 text-[12.5px] text-fg-2">
              <span className="font-semibold text-fg">{progress.reviewedCount}</span> of{" "}
              {progress.totalCount} fields reviewed
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            {canReview && (
              <span className="hidden rounded-[7px] border border-border px-2.5 py-1.5 font-mono text-[11px] text-fg-3 sm:inline-block">
                A approve · E edit · R reject · ↓ next
              </span>
            )}
            <Link
              href={`/dashboard/${workspaceSlug}/export`}
              aria-disabled={!isComplete}
              className={`rounded-lg bg-accent px-[15px] py-2.5 text-[13px] font-semibold text-accent-fg transition ${
                isComplete ? "hover:opacity-90" : "pointer-events-none opacity-45"
              }`}
            >
              Finish &amp; export →
            </Link>
          </div>
        </div>
        <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-border-2">
          <div
            className="h-full rounded-full bg-success transition-[width] duration-150"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      <div className="px-5 pt-5 pb-[90px] sm:px-10 sm:pt-6.5">
        {[...DORA_FIELD_GROUPS, OTHER_GROUP].map((group) => {
          const fields = version.extraction_results.filter(
            (f) => groupForFieldCode(f.field_code).code === group.code,
          );
          if (fields.length === 0) return null;
          return (
            <div key={group.code} className="mb-[30px]">
              <div className="mb-3 flex items-baseline gap-2.5">
                <span className="font-mono text-xs font-semibold text-accent">{group.code}</span>
                <span className="text-sm font-semibold text-fg">{group.label}</span>
                <span className="text-xs text-fg-3">{fields.length} fields</span>
                {group.code === "OTHER" && (
                  <span className="text-xs text-warning">
                    — from a previous field catalogue version, no longer tracked
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                {fields.map((field) => (
                  <FieldReviewCard
                    key={field.field_code}
                    field={field}
                    validationResults={validationByField.get(field.field_code) ?? []}
                    review={reviewByField.get(field.field_code) ?? null}
                    documentVersionId={version.id}
                    documentId={doc.id}
                    workspaceSlug={workspaceSlug}
                    canReview={canReview}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
