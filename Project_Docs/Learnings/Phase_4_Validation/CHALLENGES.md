# Phase 4 — Challenges

## C1: `fail` vs `warning` needed a real distinction, not just two labels

**What happened:** The first cut of the rule set treated every failed check
the same way. `CRITICALITY_VALUE` checks free text the LLM pulled from
prose — a phrasing like `"somewhat important"` is not in the recognised
vocabulary but might still be a correct read of the contract. Marking it
`fail` alongside a genuinely malformed date or LEI would put a
human-judgement call and a hard format violation in the same bucket.

**Fix:** Added a third status, `warning`, used only by
`CRITICALITY_VALUE`. `fail` is reserved for checks with no ambiguity — a
date either parses as ISO 8601 or it does not, an LEI either is 20
alphanumeric characters or it is not.

**Interview lesson:** A binary pass/fail model works for syntactic checks
but breaks down the moment a rule is judging free text extracted by an
LLM. Introducing a middle status early (rather than overloading `fail` and
relying on the message string to communicate "this one's softer") keeps the
UI and any future pass-rate metric honest about what kind of problem was
found.

---

## C2: Deciding what counts as "no value to check" vs "missing and required"

**What happened:** Two fields — end date and LEI — can legitimately be
blank (an indefinite-term contract has no end date; not every provider has
an LEI issued). Every other field is mandatory. A single `REQUIRED_FIELD`
rule needed to treat these two differently from the other eleven without
special-casing them inside the loop.

**Fix:** Pulled the exemption into a module-level
`_OPTIONAL_FIELD_CODES: frozenset[str]`, checked once at the top of the
loop body, rather than scattering `if field_code == "b_02.02.0080"` checks
across multiple functions. Every other `_check_*` rule that touches those
same two fields (`DATE_FORMAT`, `LEI_FORMAT`) independently reports
`skipped` (not `fail`, not silently omitted) when the value is blank —
so the exemption logic lives in exactly the rules that need it, not as a
global "ignore these fields" switch.

**Interview lesson:** When a business rule has exceptions, the exception
list itself is the design decision worth naming and isolating — a
`frozenset` with a comment explaining *why* each code is there is more
maintainable than an `if/elif` chain that a future rule author has to
rediscover by reading every function.

---

## C3: A field can fail more than one rule — the upsert key had to reflect that

**What happened:** `document_versions` already had `extraction_results`
keyed on `(document_version_id, field_code)` — one row per field. Copying
that shape for `validation_results` would have meant only the *last*
written rule's result survived an upsert, silently dropping earlier
failures on the same field.

**Fix:** `validation_results` is unique on
`(document_version_id, field_code, rule_id)` (migration 0008), and Stage C
upserts with `on_conflict="document_version_id,field_code,rule_id"`
explicitly. A date field can be both malformed (`DATE_FORMAT` fails) and,
independently, the record could be re-validated after a correction — both
states are addressable without one overwriting the other.

**Interview lesson:** Don't default to copying an existing table's key
shape without checking whether the new table's cardinality is actually the
same. `extraction_results` is naturally one-row-per-field because one LLM
call produces one value per field; `validation_results` is naturally
many-rows-per-field because many independent rules can each say something
about the same value.

---

## C4: Propagating `skipped` through every upstream failure branch, not just the new code path

**What happened:** Stage C only runs when Stage B succeeded
(`extraction_ok`). But Stage B itself has three exit branches — success,
exception, and "OCR succeeded but produced empty text" — plus Stage A
(OCR) has its own failure branch that already skipped Stage B. Each of
those four existing branches set `extraction_status` but, before this
phase, had nothing to say about a Stage C that did not exist yet.

**Fix:** Every branch that sets `extraction_status` to `failed` or
`skipped` now also sets `validation_status` to `skipped` in the same
`update()` call, rather than leaving new documents in earlier failure
paths with `validation_status` stuck at its DB default (`pending`)
forever.

**Interview lesson:** Adding a new stage to an existing multi-branch
pipeline means auditing every exit point of the *previous* stage, not just
adding code to the success path. A stage that never gets set past
`pending` looks identical in the UI to a stage that is still running —
that ambiguity is worse than an explicit `skipped`.

---

## C5: A pre-existing UI filter hid the most important failure Phase 4 produces

**What happened:** End-to-end verification against a real run (AWS Customer
Agreement.pdf, 3 of 13 fields extracted) showed only 3 field cards — all
with green `REQUIRED FIELD` pass badges. Querying `validation_results`
directly in Supabase showed 8 `fail` rows for the other 10 field codes
(2 are legitimately exempt). The rule engine was correct; the UI was
silently dropping the fail cases from view.

**Root cause:** `pipeline/page.tsx` had a `.filter((f) => f.extracted_value)`
on the extraction-results list, left over from Phase 3 — written before
`REQUIRED_FIELD` existed, when a null value simply meant "nothing to show."
Once Phase 4 added a rule whose entire purpose is to flag *missing* values,
that filter meant the single most severe validation outcome (a mandatory
field that was never found) had no field card to attach its badge to and
never reached the screen.

**Fix:** Removed the truthy filter so every field the extraction stage
wrote a row for renders a card, and added a fallback state — an italic
"Not extracted" label in place of the value/confidence pip — for fields
with no extracted value. The `REQUIRED_FIELD` fail badge (and any other
rule result) now renders on those cards exactly as it does on populated
ones.

**Why it matters:** This is the failure mode "code passes tests and
compiles" does not catch. `validate_fields()` had 23 passing unit tests and
correctly produced the fail rows; `ocr_worker.py` correctly persisted them;
`tsc --noEmit` was clean. Nothing in the type system or test suite could
see that a downstream `.filter()` written for a different phase's
assumptions would erase the result before a human ever saw it. Only running
the actual pipeline against a real document and reading the database
directly — not just trusting the diff — surfaced it.

**Interview lesson:** When a new field/status is added to data a UI already
renders, re-read every existing filter and conditional that touches that
data, not just the new code path. "Missing" is not the same as "nothing to
show" the moment a rule exists whose job is to flag that something is
missing.

---

## C6: The field-code catalogue didn't match the real EBA table structure

**What happened:** while researching the landing page's "116 quality
checks" marketing claim (verifying it against a real source — it turned
out to be real, the 2024 ESAs Dry Run), a deeper check surfaced that our
own field codes were wrong. `DORA_FIELDS` used `b_01.01`/`b_02.01`/`b_03.01`
prefixes, implying our 13 fields lived in EBA DPM tables `B_01.01`
(contractual arrangements), `B_02.01` (ICT providers), `B_03.01`
(outsourced functions). Cross-referencing EBA's own "Annotated Table
Layout — DORA 4.0" (the official column-by-column table definitions)
showed this was wrong on every count: `B_01.01` is actually "Entity
maintaining the register of information" (metadata about the *filer*, not
a contract), and our actual 13 fields are spread across `B_02.01`,
`B_02.02`, `B_05.01`, and `B_06.01` instead.

**Root cause:** the original catalogue invented a simplified 3-group
numbering that *looked* plausible (it mirrors the shape of "RT.01/02/03")
without ever being checked against the real DPM table layout. Nothing in
the code, tests, or review caught this because every consumer
(`validator.py`, `export.py`, `dora-field-groups.ts`) derived its grouping
from the same self-consistent (but wrong) source — internal consistency
gave false confidence.

**Also found while fixing this:** the official schema splits our single
"Notice period" field into two real fields (financial-entity side and
ICT-provider side are tracked separately), and merges our two
"Governing law" + "Country of governing law" fields into one official
field (just the country code — no separate free-text field exists).

**Fix:** relabelled all 13 fields to their real `B_02.01`/`B_02.02`/
`B_05.01`/`B_06.01` codes and columns (verified against EBA's own
reference workbook, not guessed), split the notice-period field in two,
dropped the free-text governing-law field. Scope was deliberately limited
to the mapping correction — the real EBA business validation rules for
these 4 tables (34 of them) turned out to be mostly multi-column
mutual-completeness checks against columns we don't extract, so
implementing them against our narrower subset would have fabricated false
rigor rather than added real rigor. See
`02_full_roi_coverage_roadmap.md` for what genuine full coverage would
require.

**Interview lesson:** internal consistency is not the same as external
correctness. A field-code scheme that every part of the codebase agrees
on can still be entirely wrong if nothing ever checked it against the
authoritative external source — the bug hides exactly where you'd
normally stop looking, because everything *inside* the system lines up.
For a compliance product specifically, this is the highest-value place to
spend verification effort: the parts that face outward, get checked by
someone who knows the domain (an investor's technical diligence, a
customer's compliance team), not just the parts covered by unit tests.
