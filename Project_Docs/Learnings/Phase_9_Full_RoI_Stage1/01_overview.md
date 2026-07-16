# Phase 9 — Full RoI coverage, Stage 1

## What we built

Expanded the DORA field catalogue from 13 fields to **all 44 real
columns** of the 4 EBA DPM tables already covered (`B_02.01`, `B_02.02`,
`B_05.01`, `B_06.01`), and replaced the 7 hand-approximated validation
rule types with **12 rule types implementing all 34 of the real EBA
business validation rules** that apply to those 4 tables. This is Stage 1
of the two-stage roadmap written during the earlier field-mapping fix
(`Project_Docs/Learnings/Phase_4_Validation/02_full_roi_coverage_roadmap.md`)
— extract every column of the tables we already cover, and implement the
real rules for them, before touching any new table.

## Why it matters

The product's pitch is measured against the regulator's own 116-check bar.
Before this phase, the gap between "13 generically-validated fields" and
"116 real checks" was honestly documented but not measurably closed. This
phase closes a third of it with verifiable numbers: 44/44 real columns for
4 tables, 34/34 real business rules for those same 4 tables — both figures
independently confirmed against EBA's own machine-readable rule data, not
estimated.

## Sourcing — the same discipline that fixed the original field-code bug

Everything in this phase was verified against EBA's own primary sources,
downloaded and parsed directly rather than taken from secondary summaries:

1. **Column list**: EBA's "Data Model for DORA RoI" PDF
   (`eba.europa.eu/.../Data Model for DORA RoI.pdf`), extracted with
   `pdftotext -layout` and read directly — gives every column's code,
   label, and (in a structured table later in the document) type/PK/FK/
   nullable flags for all 14 real RoI tables.
2. **Business rules**: EBA's DORA validation-rules workbook
   (`EBA Validation Rules 2025-03-20 deactivation.xlsx`), parsed with
   `openpyxl` and filtered to `Frameworks contains "DORA"`: 71 total rules,
   58 active. Grouping by `Tables` confirmed 34 apply to the 4 tables this
   phase covers — independently matching the estimate already written in
   the Stage 1 roadmap doc before this phase started.
3. **Enum/allowed values**: EBA's "List of possible values for all data
   fields with drop downs" workbook, one sheet per table
   (`B0201`, `B0202`, `B0501`, `B0601`), parsed the same way.

**Third-party sources were actively misleading here and were discarded.**
Two different compliance-vendor blog posts, searched while scoping this
phase, gave two *different, mutually contradictory* table-code mappings
for `B_02.01`/`B_03.01` (one had `B_02.01` as the ICT provider list and
`B_03.01` as contractual arrangements; the other had the opposite) —
exactly the kind of secondary-source error that produced the original
field-code bug this project already had to fix once
(`Phase_4_Validation/CHALLENGES.md` C6). This phase used EBA's own PDF and
workbooks exclusively for anything that ended up in code.

## The rule-engine design: two shapes, not 34 functions

Reading the real rule expressions (EBA's own DPM expression language,
e.g. `if (not(isnull({c0030}))) or not((isnull({c0040}))) ... then
(not(isnull({c0050})))`) showed that the 34 rules for these 4 tables
resolve into two repeatable shapes rather than 34 bespoke checks:

- **Completeness groups** (the large majority): "if any column in this
  set is filled, every column in the set must be." EBA expresses this as
  N rotated per-column rules (e.g. `v8850_m`…`v8855_m` for `B_05.01`, one
  rule per rotated "then" column); this codebase implements it once per
  table as a declarative `_COMPLETENESS_GROUPS` entry plus a single
  `_check_completeness_group` function.
- **Conditional pairs**: "if field A has value X, field B is required."
  Only one such rule applies to these 4 tables (arrangement type
  "subsequent or associated" → overarching reference number required) —
  a small declarative `_CONDITIONAL_PAIRS` list.

A field inside a completeness group is excluded from the flat
`REQUIRED_FIELD` check (its requiredness is conditional on its group, not
absolute) — this is itself a real behaviour change from Stage 0: fields
like `b_05.01.0050` (provider name) that used to be unconditionally
required now pass only via the group check, which in practice behaves
identically for any real provider row but is the more accurate rule.

## One correctness bug found and fixed along the way

`b_06.01.0030` was labelled "Function or service outsourced" in the
pre-Stage-1 catalogue. The real EBA column 0030 for `B_06.01` is
**"Function name"** — the field code was already correct (pointing at the
right column), only the human-readable label was wrong. Also corrected:
`CRITICALITY_VALUE`'s allowed-value set previously included invented
terms (`critical`, `non-critical`, `important`, `not important`) not in
EBA's real 3-value dropdown for that column (`Assessment not performed` /
`Yes` / `No`).

## What changed, file by file

- `apps/api/app/pipeline/field_extractor.py` — `DORA_FIELDS` 13 → 44
  entries; `max_tokens` on the extraction completion raised 2048 → 4096
  (a 45-field JSON response needs real headroom).
- `apps/api/app/pipeline/validator.py` — added `_check_completeness_group`,
  `_check_conditional_pairs`, `_check_allowed_values`,
  `_check_currency_format`, `_check_non_negative_numeric`; extended
  `_check_lei_format`/`_check_country_codes`/`_check_date_format` to loop
  over the new LEI-shaped/country-shaped/date-shaped fields; corrected
  `_ALLOWED_CRITICALITY_VALUES`.
- `apps/api/app/pipeline/export.py` — no logic changes needed; both
  `build_template_groups()` and the CSV builders already derive from
  `DORA_FIELDS`, confirming the earlier design decision documented in
  Phase 6 to avoid hand-duplicating the field list here.
- `apps/web/.../review/dora-field-groups.ts` — refactored from a fully
  duplicated `FieldGroup[]` array with a closed union type to a small
  `GROUP_LABELS: Record<string,string>` map, mirroring the backend's
  `_GROUP_LABELS`, with the `RT.` code and `FieldGroup` objects derived
  programmatically. No behaviour change for Stage 1 (same 4 groups) — this
  is the foundation Stage 2 needs so a new table is one map entry, not a
  second hand-copied list plus a type-union edit.
- Backend tests: `_VALID_VALUES` in `test_validator.py` expanded to all 44
  codes (every completeness-group member filled, since a partially-filled
  group produces fails); 18 new tests for the 5 new rule types;
  `test_export.py`'s per-group field-count assertion updated to
  `{"RT.02.01":5,"RT.02.02":17,"RT.05.01":12,"RT.06.01":10}`.
- Landing page (`apps/web/src/app/page.tsx`) — stats strip updated
  (13→44 fields, 7→12 rule types); a sample field code in the "trust"
  section corrected from `b_01.01.0010` (a table we don't cover) to
  `b_02.01.0010` (the real code for the value already shown there).
- `Project_Docs/Learnings/Phase_4_Validation/02_full_roi_coverage_roadmap.md`
  — updated coverage numbers; corrected an earlier guess of "16 tables
  plus B_99.01" to the real 14-table structure per EBA's own Data Model
  document.

## Verification

`pytest` (54 tests, all green), `ruff check .` (clean), `npx tsc --noEmit`
(clean). End-to-end: re-ran the pipeline against a real uploaded contract
and confirmed the new fields extract, the new rules fire correctly in the
live database, the Review page renders all 4 groups with the expanded
field set, and the export zip's CSVs contain the new columns — see
`CHALLENGES.md` for what that pass found.
