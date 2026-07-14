/**
 * Shared presentational pieces for rendering a DORA field's extraction
 * confidence and validation results.
 *
 * Used by both the Pipeline page (run history) and the Review page (human
 * review workspace) — kept in one place so the two views can't quietly
 * drift apart the way the Pipeline page's field-visibility filter did in
 * Phase 4 (see CHALLENGES.md C5 in that phase's Learnings doc).
 */

import type { ValidationResultRow, ValidationStatus } from "@/lib/supabase/database.types";

export function ConfidencePip({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const colour =
    pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-danger";
  return (
    <span className={`text-[10px] ${colour}`}>
      {pct}% confidence
    </span>
  );
}

const VALIDATION_BADGE_STYLES: Record<ValidationStatus, string> = {
  pass: "bg-success/15 text-success",
  fail: "bg-danger/15 text-danger",
  warning: "bg-warning/15 text-warning",
  skipped: "bg-foreground/10 text-foreground/40",
};

export function ValidationBadges({
  results,
}: {
  results: Pick<ValidationResultRow, "rule_id" | "rule_label" | "status" | "message">[];
}) {
  // 'skipped' means the rule had nothing to check (e.g. optional field left
  // blank) — not informative next to a value the reviewer can already see.
  const visible = results.filter((r) => r.status !== "skipped");
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 pt-0.5">
      {visible.map((r) => (
        <span
          key={r.rule_id}
          title={r.message ?? r.rule_label}
          className={`rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${VALIDATION_BADGE_STYLES[r.status as ValidationStatus]}`}
        >
          {r.rule_id.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}
