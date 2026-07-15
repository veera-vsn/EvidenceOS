"use client";

/**
 * FieldReviewCard — the only interactive surface on the review detail page.
 *
 * Idle state shows a three-way segmented control (Approve / Edit / Reject).
 * Edit swaps the value for an inline input; Reject reveals a required
 * textarea (Submit is disabled until non-empty — a client-side mirror of
 * the field_reviews.rejected-requires-notes CHECK constraint). All three
 * paths call submitFieldReview inside useTransition, same shape as
 * start-run-form.tsx's inline error handling.
 *
 * The three action buttons carry `data-field-code`/`data-action`
 * attributes purely so `ReviewKeyboardShortcuts` (a sibling component)
 * can trigger them via a simulated click for the page's A/E/R keyboard
 * shortcuts — a DOM-level hook rather than lifting this component's
 * state into a shared store, so the working approve/edit/reject logic
 * here stays untouched.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ConfidencePip, ValidationBadges } from "../_components/field-badges";
import type {
  ExtractionResultRow,
  FieldReviewRow,
  ReviewDecision,
  ValidationResultRow,
} from "@/lib/supabase/database.types";
import { submitFieldReview } from "./actions";
import { reviewDecisionLabel } from "./review-utils";

type Mode = "idle" | "editing" | "rejecting";

interface FieldReviewCardProps {
  field: Pick<ExtractionResultRow, "field_code" | "field_label" | "extracted_value" | "confidence">;
  validationResults: Pick<ValidationResultRow, "rule_id" | "rule_label" | "status" | "message">[];
  review: Pick<FieldReviewRow, "decision" | "edited_value" | "notes"> | null;
  documentVersionId: string;
  documentId: string;
  workspaceSlug: string;
  canReview: boolean;
}

const ACTIVE =
  "rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-40";
const INACTIVE =
  "rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-fg hover:bg-surface-2 disabled:opacity-40";
const REJECT_INACTIVE =
  "rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-danger hover:bg-surface-2 disabled:opacity-40";

export function FieldReviewCard({
  field,
  validationResults,
  review,
  documentVersionId,
  documentId,
  workspaceSlug,
  canReview,
}: FieldReviewCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("idle");
  const [draftValue, setDraftValue] = useState(field.extracted_value ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // A reviewer's correction supersedes the AI-extracted value everywhere the
  // idle view displays "the value" — otherwise an edited field would show
  // "Not extracted" right next to an "Edited" badge, which reads as if the
  // correction vanished.
  const displayValue = review?.decision === "edited" ? review.edited_value : field.extracted_value;
  const decision = (review?.decision as ReviewDecision) ?? null;

  function submit(submission: Parameters<typeof submitFieldReview>[4]) {
    setError(null);
    startTransition(async () => {
      const result = await submitFieldReview(
        documentVersionId,
        field.field_code,
        documentId,
        workspaceSlug,
        submission,
      );
      if (result.error) {
        setError(result.error);
      } else {
        setMode("idle");
        router.refresh();
      }
    });
  }

  return (
    <div
      id={`field-${field.field_code}`}
      data-decision={decision ?? "pending"}
      className={`rounded-[11px] border bg-surface p-4 shadow-card ${
        mode === "rejecting" ? "border-danger" : "border-border"
      }`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor:
          decision === "rejected"
            ? "var(--danger)"
            : decision === "approved" || decision === "edited"
              ? "var(--success)"
              : "var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[11px] text-fg-3">{field.field_code}</span>
            <span className="text-[13.5px] font-semibold text-fg">{field.field_label}</span>
          </div>

          {mode === "editing" ? (
            <div className="mt-2.5 flex items-center gap-2">
              <input
                className="flex-1 rounded-lg border border-accent bg-surface-2 px-3 py-2 text-sm text-fg outline-none"
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                disabled={isPending}
                autoFocus
              />
              <button
                className={ACTIVE}
                disabled={draftValue.trim() === "" || isPending}
                onClick={() => submit({ decision: "edited", editedValue: draftValue.trim() })}
              >
                Save
              </button>
              <button className={INACTIVE} disabled={isPending} onClick={() => setMode("idle")}>
                Cancel
              </button>
            </div>
          ) : displayValue ? (
            review?.decision === "edited" ? (
              <div className="mt-2.5">
                <div className="font-mono text-[9.5px] tracking-wide text-success uppercase">
                  Corrected value
                </div>
                <div className="mt-0.5 text-[15px] font-medium text-fg">{displayValue}</div>
              </div>
            ) : (
              <div className="mt-2.5 flex items-baseline gap-3">
                <span className="text-[15px] font-medium text-fg">{displayValue}</span>
                <ConfidencePip confidence={field.confidence ?? 0} />
              </div>
            )
          ) : (
            <span className="mt-2.5 block text-[15px] italic text-fg-3">Not extracted</span>
          )}

          <ValidationBadges results={validationResults} />
        </div>

        <ReviewDecisionBadge decision={decision} />
      </div>

      {mode === "rejecting" && (
        <div className="mt-3.5 rounded-[9px] border border-danger bg-danger-soft p-3.5">
          <div className="font-mono text-[9.5px] font-semibold tracking-wide text-danger uppercase">
            Rejection reason — required · permanent audit record
          </div>
          <textarea
            className="mt-2.5 min-h-[72px] w-full resize-y rounded-lg border border-danger bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-fg outline-none"
            placeholder="Explain precisely why this value is wrong. An auditor or national regulator may read this later."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isPending}
            autoFocus
          />
          <div className="mt-2.5 flex justify-end gap-2">
            <button className={INACTIVE} disabled={isPending} onClick={() => setMode("idle")}>
              Cancel
            </button>
            <button
              className="rounded-lg bg-danger px-3.5 py-2 text-[12.5px] font-semibold text-white transition disabled:opacity-40"
              disabled={notes.trim() === "" || isPending}
              onClick={() => submit({ decision: "rejected", notes: notes.trim() })}
            >
              Submit rejection
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3.5 rounded-lg border border-danger bg-danger-soft px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {canReview && mode === "idle" && (
        <div className="mt-3.5 flex gap-2 border-t border-border-2 pt-3.5">
          <button
            data-field-code={field.field_code}
            data-action="approve"
            className={`flex-1 ${decision === "approved" ? ACTIVE : INACTIVE}`}
            disabled={isPending}
            onClick={() => submit({ decision: "approved" })}
          >
            ✓ Approve
          </button>
          <button
            data-field-code={field.field_code}
            data-action="edit"
            className={`flex-1 ${decision === "edited" ? ACTIVE : INACTIVE}`}
            disabled={isPending}
            onClick={() => {
              setDraftValue(review?.edited_value ?? field.extracted_value ?? "");
              setMode("editing");
            }}
          >
            ✎ Edit
          </button>
          <button
            data-field-code={field.field_code}
            data-action="reject"
            className={`flex-1 ${decision === "rejected" ? ACTIVE : REJECT_INACTIVE}`}
            disabled={isPending}
            onClick={() => setMode("rejecting")}
          >
            ✕ Reject
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewDecisionBadge({ decision }: { decision: ReviewDecision | null }) {
  if (!decision) {
    return (
      <span className="flex-none rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-semibold text-fg-2">
        Pending review
      </span>
    );
  }
  const colour = decision === "rejected" ? "bg-danger-soft text-danger" : "bg-success-soft text-success";
  return (
    <span className={`inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${colour}`}>
      <DecisionIcon decision={decision} />
      {reviewDecisionLabel(decision)}
    </span>
  );
}

function DecisionIcon({ decision }: { decision: ReviewDecision }) {
  const shared = {
    className: "h-3 w-3",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (decision === "approved") {
    return (
      <svg {...shared}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (decision === "edited") {
    return (
      <svg {...shared}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }
  return (
    <svg {...shared}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
