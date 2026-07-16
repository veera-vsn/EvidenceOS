# Phase 4 — Deterministic Validation

## What we built

A rule-based validation engine that runs after field extraction and checks
every extracted DORA RoI field against ESMA-style quality rules — no LLM
involved. Each check produces a `pass`, `fail`, `warning`, or `skipped`
result per `(field_code, rule_id)` pair, persisted to a new
`validation_results` table and surfaced as colour-coded badges next to each
field on the pipeline page.

## Why it matters

The determinism gate is the core trust argument of this product: an LLM may
find a value, but only a testable, rule-based check may decide whether that
value is compliant. If "pass/fail" ever depended on an LLM's judgement, the
product could not be defended to a regulator or an auditor — the same input
would not reliably produce the same output. Phase 4 is the first piece of
the pipeline that actually renders a compliance verdict, so it is the piece
that has to be provably deterministic.

It also closes the loop the [2024 EU-wide ESAs dry run](https://www.eba.europa.eu/publications-and-media/press-releases/esas-dry-run-exercise-shows-goal-reporting-registers-information-under-digital-operational)
exposed: only 6.5% of ~1,000 participating firms passed every one of the
116 real DORA RoI data quality checks. Phase 4 does not implement all 116
yet — it implements 7 rule types (producing 19 checks across the 13 fields
we currently extract) — but it is the scaffold every future rule slots
into.

## How it fits in the pipeline

```
Upload (Phase 1) → OCR (Phase 2) → Field extraction (Phase 3) → Validation (Phase 4)
                                                                        ↓
                                                          validation_results (Supabase)
                                                                        ↓
                                                   Human review UI (Phase 5 — future)
```

Validation is Stage C in `ocr_worker.py`, gated on Stage B (extraction)
having succeeded — the same fail-forward pattern OCR/extraction already use.
A failure anywhere upstream marks every stage after it `skipped`, never
`failed`, so the run status accurately reflects "nothing ran" versus
"something ran and broke."

## Files introduced / changed

| File | Purpose |
|---|---|
| `apps/api/app/pipeline/validator.py` | 8 deterministic rule checks over the 13 DORA fields |
| `apps/api/tests/test_validator.py` | 23 unit tests — every rule, every branch, no DB/LLM |
| `supabase/migrations/0008_validation_results.sql` | Persistent store, one row per field × rule |
| `apps/web/src/lib/supabase/database.types.ts` | Regenerated types incl. `validation_results` |
| `apps/web/src/app/dashboard/[workspaceSlug]/pipeline/page.tsx` | `ValidationBadges` component on the fields grid |

`ocr_worker.py` was updated to call `validate_fields()` after extraction
succeeds (Stage C) and upsert results keyed on
`(document_version_id, field_code, rule_id)`.

End-to-end verification against a real run caught one further bug fixed in
this phase: the pipeline page filtered out any field with no extracted
value, which hid the `REQUIRED_FIELD` fail badge for every missing
mandatory field — see `CHALLENGES.md` C5.

## The 8 rules (Phase 4 scope)

| Rule ID | Checks | Severity |
|---|---|---|
| `REQUIRED_FIELD` | Every mandatory field has a non-blank value | fail |
| `DATE_FORMAT` | Start/end dates are valid ISO 8601 (`YYYY-MM-DD`) | fail |
| `DATE_LOGIC` | End date is strictly after start date (cross-field) | fail |
| `NOTICE_PERIOD` | Notice period is a positive integer | fail |
| `COUNTRY_CODE` | Governing-law / provider country is ISO 3166-1 alpha-2 | fail |
| `LEI_FORMAT` | LEI is exactly 20 alphanumeric characters | fail |
| `CRITICALITY_VALUE` | Criticality uses a recognised term | **warning** |

`REQUIRED_FIELD` runs against all 13 fields; the others target the specific
field(s) the rule applies to. Two fields (`b_01.01.0040` end date and
`b_02.01.0020` LEI) are exempt from `REQUIRED_FIELD` because a blank value
is legitimately correct — an indefinite-term contract has no end date, and
not every provider has an LEI issued yet.

## Key design decisions

**Rule engine is pure functions, zero I/O.** `validate_fields()` takes a
`dict[str, str | None]` and returns a list of dataclasses — no Supabase
client, no network call. This is what makes the 23-test suite instant
(4.7s including Python interpreter startup) and lets any future rule be
tested in isolation before it touches the pipeline.

**`warning` is a distinct status from `fail`.** `CRITICALITY_VALUE` checks
free text that the LLM extracted, not a fixed-format field like a date or an
LEI. A phrasing outside the recognised set (`"somewhat important"` instead
of `"important"`) might still be correct — a human reviewer, not a regex,
should make that call. Treating it as `fail` would train reviewers to
distrust the validator; `warning` keeps the signal honest.

**`skipped` is not `pass`.** A rule with nothing to check (blank optional
field, malformed date that `DATE_FORMAT` already flagged) reports `skipped`
rather than silently omitting a row or reporting `pass`. This keeps the
table an honest audit log: every `(field, rule)` pair examined has a row,
and `skipped` is visibly different from "we checked it and it was fine."

**Composite upsert key.** `validation_results` is unique on
`(document_version_id, field_code, rule_id)`, not just
`document_version_id`. A field can fail multiple independent rules (a date
could be malformed *and* the record could still be missing something else
entirely) and each needs its own row so the UI can show every relevant
badge, not just the first problem found.

## Interview Q&A

**Q: Why not let the LLM decide pass/fail directly during extraction?**
A: Determinism and auditability. An LLM given the same document twice can
return slightly different phrasing or, at temperature > 0, a different
verdict. A regulator-facing "this field is non-compliant" needs to be
reproducible and explainable by a fixed rule, not a model's opinion on a
given day. See `CLAUDE.md` §7 — LLMs suggest and flag ambiguity, they never
decide.

**Q: How would you scale from 8 rules to the full 116 ESMA checks?**
A: The module is already shaped for it — `validate_fields()` is a flat list
of `_check_*` functions, each independent and independently testable. Adding
rule 9 means adding one function and one line in `validate_fields()`; it
does not require touching the 8 that exist. The real work at scale is
sourcing the ESMA rule definitions accurately, not the code shape.

**Q: What happens if extraction found a value but it's syntactically valid
in isolation yet wrong in context (e.g. a plausible-looking but wrong LEI)?**
A: Format rules like `LEI_FORMAT` only check shape (20 alphanumeric
characters), not registry membership — that would require an external LEI
lookup, which is out of scope for a deterministic, offline check. A future
rule could call the GLEIF API for existence and legal-name matching; that
belongs in a validation category with its own retry/timeout handling rather
than the offline rule set.

**Q: Why does a failure in OCR skip validation with `skipped`, not
`failed`?**
A: `failed` should mean "we ran this stage and it errored." If OCR never
produced text, Stage C never had inputs to check — reporting `failed` would
misattribute the fault. `skipped` accurately says "did not run, and here is
why" (visible in the upstream stage's status).
