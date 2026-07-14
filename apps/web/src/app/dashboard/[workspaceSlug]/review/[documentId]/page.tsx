/**
 * `/dashboard/[workspaceSlug]/review/[documentId]` — per-document review
 * workspace.
 *
 * Shows the document's latest validated version, grouped into the three
 * ESMA template sections, with one FieldReviewCard per DORA field.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canReviewFields, getCurrentWorkspaceRole } from "@/lib/supabase/workspace-role";
import type {
  ExtractionResultRow,
  FieldReviewRow,
  ValidationResultRow,
} from "@/lib/supabase/database.types";

import { DORA_FIELD_GROUPS, groupForFieldCode } from "../dora-field-groups";
import { computeReviewProgress } from "../review-utils";
import { FieldReviewCard } from "../field-review-card";

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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <section className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{doc.name}</h1>
        <p className="text-sm text-foreground/60">
          {progress.reviewedCount} of {progress.totalCount} fields reviewed
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </section>

      {DORA_FIELD_GROUPS.map((group) => {
        const fields = version.extraction_results.filter(
          (f) => groupForFieldCode(f.field_code).code === group.code,
        );
        if (fields.length === 0) return null;
        return (
          <section key={group.code} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-foreground/70">
              {group.code} — {group.label}
            </h2>
            <div className="flex flex-col gap-3">
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
          </section>
        );
      })}
    </div>
  );
}
