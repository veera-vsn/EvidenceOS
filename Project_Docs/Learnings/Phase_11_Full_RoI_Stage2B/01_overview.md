# Phase 11 — Full RoI coverage, Stage 2B (Entity Profile)

## What we built

The last 8 of the DORA RoI's 14 real EBA tables — `B_01.01`–`B_01.03`
(the filer's own entity/branch identity), `B_02.03` (intra-group
arrangements), `B_03.01`–`B_03.03` (signing entities), `B_04.01`
(entities using the ICT services). Unlike every table in Stages 1/2A,
none of these are extracted from a vendor document — they describe the
filer's own organisation. This phase adds this app's first
workspace-settings page (`/dashboard/[workspaceSlug]/settings`), a new
migration (`entity_profiles`/`entity_branches`), and export-time logic
that derives 6 of the 8 tables automatically from one form plus data
already sitting in `extraction_results`.

This closes Full RoI Stage 2 entirely — all 14 real EBA RoI tables now
have a path to being populated in an export.

## Why it matters

The product's honest coverage story goes from "6 of 14 tables" to
"14 of 14 tables, with one deliberately-scoped simplification (no
multi-entity groups yet) clearly documented and easy to point to." That
is a materially stronger claim to make on a landing page or in investor
diligence than another few fields added to an already-covered table
would have been.

## The design decision that made this affordable

Building genuine multi-entity, multi-branch, multi-signing-relationship
support — the fully general version of these 8 tables — would have been
a much bigger lift: real group hierarchy, a UI for assigning which
entity signs which contract, non-default branch routing. Investigating
what these 8 tables actually need for this product's *stated* target
customer (a standalone mid-sized EU financial entity, not a banking
group) found that 6 of the 8 collapse to mechanical derivations once one
simple form exists:

- `B_01.02` is `B_01.01` mirrored, plus two fields (total assets,
  currency) that only exist on `B_01.02`.
- `B_02.03`/`B_03.03` (intra-group tables) are provably always empty for
  an entity with no group — there is nothing to derive, and nothing to
  ask the user for.
- `B_03.01`/`B_03.02`/`B_04.01` are one row per exported document,
  entirely computable from the entity profile plus that document's own
  `B_02.01`/`B_05.01` fields (the contract's reference number and the
  provider's identity) — data the pipeline already extracted and
  reviewed in Stages 1/2A.

That left exactly one genuinely new user-facing surface: a form for
`B_01.01` (5 required fields) plus an optional add-a-branch list for
`B_01.03`. Everything else followed from that one design insight rather
than needing separate UI work per table.

## Why this isn't "extraction, validation, review" like every earlier phase

Every phase before this one added to the `DORA_FIELDS` catalogue,
`validator.py`'s rule engine, and the `field_reviews` approve/edit/reject
flow. This phase deliberately does none of that. `entity_profiles` is
user-entered settings data with no AI extraction step and no reviewer
decision — there is no "confidence score" for your own company's LEI,
and no meaningful "reject" action for a fact the user just typed in
themselves. Routing it through `validator.py`'s `COMPLETENESS_GROUP`/
`ALLOWED_VALUE` machinery (built for LLM-extracted free text with
graduated confidence) would have been the wrong tool for straightforward
form validation (required fields, LEI regex, one of 22 real EBA entity
types) — so the Server Action validates directly instead.

## What changed, file by file

- `supabase/migrations/0010_entity_profile.sql` — `entity_profiles`
  (workspace-scoped, `UNIQUE(workspace_id)` — one profile per workspace)
  and `entity_branches`, RLS reusing the existing
  `is_workspace_member`/`has_workspace_role` helper functions from
  migration `0001` rather than redefining them; write access gated to
  `owner`/`admin`, matching `workspaces_update_owner_admin`'s existing
  precedent since this is workspace identity, not a `reviewer`-level
  action.
- `apps/api/app/pipeline/export_types.py` (new) — `ExportableDocument`
  moved here from `export.py` to break a circular import: `export.py`
  now imports builder functions from `entity_export.py`, and
  `entity_export.py` needs `ExportableDocument`'s shape to build the
  derived `B_03.01`/`B_03.02`/`B_04.01` rows.
- `apps/api/app/pipeline/entity_export.py` (new) — `fetch_entity_profile`/
  `fetch_entity_branches` (DB-touching) plus 8 pure CSV builders, one per
  table, following the same "DB-touching resolver + pure builder" split
  `export.py` already established in Phase 6.
- `apps/api/app/pipeline/export.py` — `build_export_zip()` fetches the
  entity profile/branches once, writes the 8 new/updated CSVs, and the
  manifest gets one new conditional line when no profile is configured
  yet. Zero changes to `build_template_groups()`/`DORA_FIELDS` — entity
  data is deliberately outside that catalogue.
- `apps/web/src/lib/supabase/workspace-role.ts` — `canEditEntityProfile`,
  mirroring `canReviewFields`'s existing shape and docstring.
- `apps/web/src/app/dashboard/[workspaceSlug]/settings/` (new route) —
  `page.tsx` (Server Component, same role-fetch pattern
  `review/[documentId]/page.tsx` already uses), `actions.ts`
  (`saveEntityProfile`/`addBranch`/`removeBranch`, typed-args /
  `{error?}`-return shape matching `documents/actions.ts`),
  `entity-profile-form.tsx` (client form, same `useTransition` pattern
  `field-review-card.tsx` already uses), `entity-types.ts` (the real
  22-value EBA "Type of entity" enum, one source of truth for both the
  form's `<select>` and the action's server-side validation).
- `apps/web/src/app/dashboard/[workspaceSlug]/sidebar-nav.tsx` — one new
  `items` entry, appended after Export.

## Verification

`pytest` (77 tests total, 14 new for `entity_export.py`), `ruff check .`
(clean), `npx tsc --noEmit` (clean). Migration applied to the real
Supabase project (with explicit user confirmation — the permission
system correctly flagged applying schema DDL to a live database as a
shared-resource action worth double-checking, even mid-implementation of
an already-approved plan); `get_advisors` showed no new security findings
attributable to the new tables. See `CHALLENGES.md` for what that
permission check caught and why it was right to stop for it.
