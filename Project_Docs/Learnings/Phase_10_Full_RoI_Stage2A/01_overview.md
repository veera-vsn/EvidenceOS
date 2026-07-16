# Phase 10 — Full RoI coverage, Stage 2A

## What we built

Added the two remaining EBA RoI tables that fit the existing per-contract
extraction pattern — `B_05.02` (ICT service supply chains / sub-outsourcing,
6 fields, 0 EBA business rules) and `B_07.01` (assessment of the ICT
services — substitutability, exit planning, audit history, 11 fields,
8 EBA business rules) — taking the catalogue from 44 to 61 fields and 6
of the 14 real RoI tables covered.

This is **Stage 2A** of the two-part Stage 2 split scoped at the end of
Phase 9: the other 8 remaining tables (`B_01.01`–`B_01.03`,
`B_02.03`, `B_03.01`–`B_03.03`, `B_04.01`) capture the filer's own
organisation rather than contract data and need a different UI (a
workspace Entity Profile), so they were deliberately left out of this
pass — see `Phase_4_Validation/02_full_roi_coverage_roadmap.md`'s
"Stage 2B" section for the design sketch queued next.

## Why it matters

Same reason as Stage 1: every table added here is independently
verifiable against EBA's own published data, and every table added moves
the honest "44/61 fields across 6/14 tables" framing on the landing page
and in investor materials closer to the regulator's real bar without ever
overclaiming it.

## What was reused vs what was new

Everything in `field_extractor.py` and `export.py` needed **zero
structural changes** — both were already designed in Stage 1 to derive
prompts and export groups from the `DORA_FIELDS` catalogue, so adding 19
new entries (later trimmed to 17 — see below) was purely additive data.
`dora-field-groups.ts` needed exactly the one-line-per-table edit its
Stage 1 refactor was built to make trivial.

`validator.py` needed one real structural change:
`_CONDITIONAL_PAIRS` previously matched against a single trigger value
(Stage 1's only conditional rule had one). `B_07.01`'s conditional rule
(`v8825_m`: if substitutability is "Not substitutable" **or** "Highly
complex substitutability", the reason field becomes required) has two
trigger values, so the tuple shape changed from
`(if_code, single_value, then_code)` to
`(if_code, frozenset[values], then_code)`. Everything else — the new
completeness group, the new enum values — was additive data using the
exact same mechanisms Stage 1 built.

## A design correction caught before it shipped, not after

While adding `B_05.02.0010` and `B_07.01.0010` (both literally
"Contractual arrangement reference number" per EBA's own schema — every
one of the six tables covered so far has its own real, distinct column
for this), a check against Stage 1's precedent surfaced an inconsistency:
Stage 1's `B_02.02` genuinely **does** have its own real `0010` column in
EBA's schema too, but Stage 1 deliberately didn't create a separate
`b_02.02.0010` field — reasoning (recorded in Phase 9's CHALLENGES.md C3)
that extracting the same real-world reference number twice from one
document is redundant, since the export's one-row-per-document model
already joins every template CSV via `document_id`.

Given that's already a shipped, intentional simplification, adding
`b_05.02.0010`/`b_07.01.0010` as new independent fields would have been
inconsistent with it — two tables getting a field the third
(`B_02.02`) deliberately doesn't have, purely because Stage 2A happened
second. Dropped both before running any tests (19 → 17 new fields, 63 →
61 total) rather than shipping the inconsistency and discovering it
later during a Stage 2B cross-check.

## Verification

`pytest` (62 tests, all green — 8 new tests for the multi-value
conditional, the `B_07.01` completeness group, `B_05.02`'s absence of
one, and the shared "Type of ICT services" enum), `ruff check .`
(clean), `npx tsc --noEmit` (clean). See `CHALLENGES.md` for the one
design issue this phase's own review process caught.

Also ran the real pipeline end-to-end against the same test document used
in Stage 1: extraction correctly requested all 61 fields (confirmed via
the backend log's `fields=61`), validation correctly produced 82 results
matching the same all-null baseline already proven in a unit test, the
Review page renders all 6 real groups (`RT.02.01`/`RT.02.02`/`RT.05.01`/
`RT.06.01`/`RT.05.02`/`RT.07.01`) plus the `OTHER` bucket correctly
catching 10 pre-existing stale rows, and the export zip's two new CSVs
have the expected 6/11-column headers. Extraction again found 0 of 61
fields on this specific document — the same LLM fill-rate variance
already documented in Phase 9's CHALLENGES.md C5, not a new issue.
