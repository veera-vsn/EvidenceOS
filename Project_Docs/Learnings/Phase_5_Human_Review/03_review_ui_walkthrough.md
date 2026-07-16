# Review UI — walkthrough

## Information architecture

Two pages, list → detail, the ticket-queue pattern rather than folding
review controls into the existing Pipeline page:

- `review/page.tsx` — every document with at least one validated version,
  most-recently-validated first, each with an `N/13 reviewed` progress
  badge.
- `review/[documentId]/page.tsx` — one document's fields, grouped into the
  three ESMA template sections, each field rendered as a full-width
  `FieldReviewCard`.

The Pipeline page stays run-centric (every run, including old failed or
superseded ones); Review is version-centric (only the current state of the
document a reviewer actually cares about). Splitting them keeps neither
page trying to serve both audiences.

## Eligibility query — `review/page.tsx`

```ts
const eligible = (doc.document_versions ?? []).filter(
  (v) => v.validation_results.length > 0,
);
if (eligible.length === 0) return null; // document omitted entirely
const latest = eligible.reduce((a, b) => (b.version_number > a.version_number ? b : a));
```

Eligibility is "has this version been validated at least once" — not "did
the most recent pipeline run succeed." Because `validation_results` is
upserted per `document_version_id` regardless of which run wrote it, this
sidesteps the run-tracking Pipeline page has to do (joining through
`pipeline_run_documents` to find the latest *successful* run for a
version). A document validated by an old run and never re-run is still
correctly reviewable.

## `dora-field-groups.ts` — grouping fields the way a reviewer thinks about them

```ts
export const DORA_FIELD_GROUPS: FieldGroup[] = [
  { code: "RT.02.01", label: "Contractual arrangements — general", prefix: "b_02.01" },
  { code: "RT.02.02", label: "Contractual arrangements — specific", prefix: "b_02.02" },
  { code: "RT.05.01", label: "ICT third-party providers", prefix: "b_05.01" },
  { code: "RT.06.01", label: "Functions identification", prefix: "b_06.01" },
];
```

Nothing in the database encodes this grouping — `extraction_results` and
`validation_results` are flat, keyed only by `field_code`. A compliance
analyst thinks in terms of ESMA RT templates, though, so the detail page
sections fields by prefix match rather than presenting one undifferentiated
list of 13.

## `field-review-card.tsx` — the one Client Component

Everything else in this feature is a Server Component; the card is the
only interactive surface (`"use client"`), holding local `mode` state
(`idle | editing | rejecting`) and calling `submitFieldReview` inside
`useTransition`, mirroring `start-run-form.tsx`'s inline-error-banner
pattern exactly.

The segmented control reuses the app's existing primary/secondary button
styles at their compact size — the *active* decision renders in the
primary-filled style, the other two stay outline:

```tsx
<button className={review?.decision === "approved" ? ACTIVE : INACTIVE} ...>Approve</button>
```

`ReviewDecisionBadge` uses **success for both `approved` and `edited`** —
both mean "the reviewer confirms this value is correct," just by different
means — distinguished only by icon (checkmark vs pencil) and label text,
not a new colour. `rejected` is the only decision that gets `danger`. This
was a deliberate constraint: the app has exactly three semantic colours
(`success`/`warning`/`danger`) and introducing a fourth for "edited" would
have been the first crack in that system.

## Displaying the corrected value (see CHALLENGES.md C1)

The idle-state value display doesn't read `field.extracted_value` directly
— it reads a computed `displayValue` that prefers the reviewer's
`edited_value` when the decision is `edited`:

```ts
const displayValue = review?.decision === "edited" ? review.edited_value : field.extracted_value;
```

`extraction_results.extracted_value` is never mutated (it's the AI's
original output, preserved for the audit trail) — the human correction
lives entirely in `field_reviews.edited_value`. The card has to actively
reconcile the two for display, or an edited field looks like the
correction disappeared.

## Role gating — `workspace-role.ts`

```ts
export async function getCurrentWorkspaceRole(supabase, workspaceId, userId) {
  const { data } = await supabase.from("workspace_members").select("role")...
  return data?.role ?? null;
}
export function canReviewFields(role) {
  return role === "reviewer" || role === "admin" || role === "owner";
}
```

This is the first place in the app that reads a user's role at all —
every prior privileged action relied on RLS alone and never surfaced the
role to a Server Component. `canReview` here controls nothing security-
relevant (RLS enforces the actual boundary); it only decides whether the
action row renders at all, so a `viewer` isn't shown three buttons that
would silently fail on click.

## Shared badges — why `field-badges.tsx` was extracted

`ConfidencePip` and `ValidationBadges` moved out of `pipeline/page.tsx`
into `_components/field-badges.tsx` in the same change that introduced
Review, before either page needed to diverge. Phase 4 had already shown
what happens when a page-local rendering choice (a `.filter()` written
for one phase's assumptions) silently outlives the assumption that
motivated it — see Phase 4's `CHALLENGES.md` C5. Making the shared pieces
literally shared code, imported by both pages, means a future change to
how a validation badge renders can't accidentally apply to one page and
not the other.
