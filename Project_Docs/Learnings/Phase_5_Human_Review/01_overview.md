# Phase 5 — Human Review UI

## What we built

A new **Review** section: a document list showing review progress, and a
per-document workspace where a compliance analyst approves, edits, or
rejects each of the 13 extracted DORA fields. This is the first feature in
the product that actually implements the human-in-the-loop rule
`CLAUDE.md` §7 states: *"Nothing auto-finalises. Every recommendation needs
a human approve event before it appears on the exported RoI."* Phases 1–4
produced values and validated them; nothing before Phase 5 let a human act
on the result.

## Why it matters

A validation badge that says "fail" is only useful if someone can do
something about it. Before this phase, a compliance analyst could see that
a field was missing or malformed but had no way to record "I looked at
this, here is the correct value" or "I looked at this, it's genuinely
missing." Phase 5 closes that loop — and is also the first feature to use
the `reviewer` workspace role, which has existed in the schema's
`workspace_role` enum since Phase 0.5 but had never been referenced by any
policy until now.

## How it fits in the pipeline

```
Upload (1) → OCR (2) → Extraction (3) → Validation (4) → Human review (5)
                                                                ↓
                                                     field_reviews (Supabase)
                                                                ↓
                                              xBRL-CSV export (Phase 6 — future)
```

Review is deliberately **document-version-centric, not pipeline-run-
centric**. A document becomes reviewable the moment its latest version has
at least one `validation_results` row — regardless of which pipeline run
produced it, and independent of `pipeline_run_documents`/`pipeline_runs`
entirely. This mirrors how `extraction_results` and `validation_results`
already work (keyed only by `document_version_id`, upserted idempotently)
and avoids re-deriving the pipeline page's run-tracking complexity for a
workflow that doesn't need it.

## Files introduced / changed

| File | Purpose |
|---|---|
| `supabase/migrations/0009_field_reviews.sql` | New table: one review decision per (document_version, field) |
| `apps/api/app/pipeline/revalidate.py` | Re-runs `validate_fields()` against the reviewer's effective value |
| `apps/api/app/pipeline/router.py` | New `POST /pipeline/documents/{id}/revalidate` endpoint |
| `apps/web/src/app/dashboard/[workspaceSlug]/review/` | List page, detail page, field card, Server Action, helpers |
| `apps/web/src/lib/supabase/workspace-role.ts` | First place in the app that reads a user's workspace role |
| `apps/web/src/app/dashboard/[workspaceSlug]/_components/field-badges.tsx` | `ConfidencePip`/`ValidationBadges` extracted so Pipeline and Review can't drift apart |

## Key design decisions

**Current-state row per field, not append-only history.** `field_reviews`
is unique on `(document_version_id, field_code)`, upserted on re-review —
the same pattern `extraction_results` and `validation_results` already
use. A second look at a field replaces the row rather than stacking a new
one. This was a deliberate trade-off, not an oversight: a full audit-log
table would suit a regulated product's story better, but nothing else in
this schema works that way yet, and every query would need "latest row per
field" logic. Revisit if the product ever needs to show *who reviewed what,
when, across every revision* rather than just the current state.

**Rejection is treated as blank for validation purposes.** When a reviewer
rejects a field, `compute_effective_values()` in `revalidate.py` maps it to
`None` before calling `validate_fields()` — so a rejected required field
fails `REQUIRED_FIELD` exactly like a field the AI never found. This is the
honest state: a rejected value is not trustworthy, so the RoI should treat
it as absent until someone provides a correction, not silently keep
showing the AI's (now-disowned) guess.

**Live re-validation, not a stale badge.** Editing a field's value calls a
new FastAPI endpoint that reruns the *exact same* `validate_fields()`
function Stage C uses, synchronously, awaited by the Server Action before
it revalidates the page. The determinism gate stays intact — only that one
pure Python function decides pass/fail, whether the value came from the
LLM or a human correction — and the reviewer sees the corrected badge
immediately rather than a result computed against a value they just
overrode.

**Two CHECK constraints, not just UI validation.** `edited` requires
`edited_value is not null`; `rejected` requires `notes is not null`. Both
are enforced at the schema level, not just as disabled buttons in
`field-review-card.tsx` — a client-side guard is a good UX default, but the
database is what actually prevents an "edited" row from silently carrying
no correction, or a rejection with no explanation for whoever fixes the
source document.

**No component library, so no new visual language.** Every element in the
review UI — cards, badges, buttons, inputs — reuses the exact Tailwind
classes and opacity-based colour tokens the rest of the app already
established. The one genuinely new pattern (a three-way segmented control)
is built from the existing primary/secondary button pair at their existing
compact size, not a new component. Consistency was the design brief here,
not new visual flourish.
