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
  "rounded-md bg-foreground px-3 py-1 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40";
const INACTIVE =
  "rounded-md border border-foreground/15 px-3 py-1 text-sm hover:bg-foreground/5 disabled:opacity-40";

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
    <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs text-foreground/40">{field.field_code}</span>
          <span className="text-sm font-medium">{field.field_label}</span>
        </div>
        <ReviewDecisionBadge decision={(review?.decision as ReviewDecision) ?? null} />
      </div>

      {mode === "editing" ? (
        <div className="flex flex-col gap-2">
          <input
            className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            disabled={isPending}
            autoFocus
          />
          <div className="flex gap-1.5">
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
        </div>
      ) : displayValue ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground/90">{displayValue}</span>
          {review?.decision === "edited" ? (
            <span className="text-[10px] text-foreground/40">Corrected value</span>
          ) : (
            <ConfidencePip confidence={field.confidence ?? 0} />
          )}
        </div>
      ) : (
        <span className="text-sm italic text-foreground/35">Not extracted</span>
      )}

      <ValidationBadges results={validationResults} />

      {mode === "rejecting" && (
        <div className="flex flex-col gap-2">
          <textarea
            className="min-h-[4rem] rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
            placeholder="Why is this value wrong? (required)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isPending}
            autoFocus
          />
          <div className="flex gap-1.5">
            <button
              className={ACTIVE}
              disabled={notes.trim() === "" || isPending}
              onClick={() => submit({ decision: "rejected", notes: notes.trim() })}
            >
              Submit rejection
            </button>
            <button className={INACTIVE} disabled={isPending} onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {canReview && mode === "idle" && (
        <div className="flex items-center gap-1.5">
          <button
            className={review?.decision === "approved" ? ACTIVE : INACTIVE}
            disabled={isPending}
            onClick={() => submit({ decision: "approved" })}
          >
            Approve
          </button>
          <button
            className={review?.decision === "edited" ? ACTIVE : INACTIVE}
            disabled={isPending}
            onClick={() => {
              setDraftValue(review?.edited_value ?? field.extracted_value ?? "");
              setMode("editing");
            }}
          >
            Edit
          </button>
          <button
            className={review?.decision === "rejected" ? ACTIVE : INACTIVE}
            disabled={isPending}
            onClick={() => {
              setNotes(review?.notes ?? "");
              setMode("rejecting");
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewDecisionBadge({ decision }: { decision: ReviewDecision | null }) {
  if (!decision) {
    return (
      <span className="rounded-md px-2 py-0.5 text-xs font-medium bg-foreground/10 text-foreground/60">
        Pending review
      </span>
    );
  }
  const colour =
    decision === "rejected" ? "bg-danger/15 text-danger" : "bg-success/15 text-success";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${colour}`}>
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
