# Phase 9 (Full RoI Stage 1) — Challenges

Matching the format every earlier phase's `CHALLENGES.md` uses: symptom,
root cause, fix, lesson.

---

## C1 — Third-party compliance sources directly contradicted each other

**Symptom:** while scoping which of the 14 real RoI tables covers what,
a web search surfaced multiple compliance-vendor blog posts summarising
the DORA RoI template list. Two of them gave *opposite* mappings for the
same table codes — one said `B_02.01` was the ICT provider list and
`B_03.01` was contractual arrangements; another said the reverse. Neither
matched what this codebase already had verified as correct from the
original field-mapping fix (Phase 4).

**Root cause:** the DORA RoI table structure is genuinely confusing (many
similarly-named tables — general/specific contractual arrangements,
receiving/providing/intra-group signing entities) and several SEO-oriented
compliance sites appear to have published summaries without checking
against EBA's own reference material.

**Fix:** stopped trusting secondary sources entirely for anything that
would end up in code. Downloaded EBA's own "Data Model for DORA RoI" PDF
directly, extracted it with `pdftotext -layout`, and read the real column
lists from the primary source. Cross-checked against the DORA
validation-rules workbook (also downloaded and parsed directly) — the two
official sources agreed with each other and with what this codebase
already had for the 4 known-correct tables, confirming both were reliable
and the blog posts were not.

**Lesson:** for anything regulatory, "two sources agree" is not enough if
both are secondary. This project already learned this once
(`Phase_4_Validation/CHALLENGES.md` C6); this phase is the second time the
same discipline (go to the regulator's own document, not a summary of it)
caught a real discrepancy before it reached code.

---

## C2 — WebFetch can't parse PDFs; `pdftotext` (already installed) can

**Symptom:** `WebFetch` on EBA's "Data Model for DORA RoI" PDF returned an
explicit failure — it could see the binary content was a PDF but couldn't
extract structured text from it, and suggested using a dedicated PDF tool.

**Root cause:** `WebFetch` converts HTML to markdown; it isn't a PDF text
extractor. Separately, the `Read` tool's PDF support renders pages via
`pdftoppm`, which wasn't installed in this environment.

**Fix:** `WebFetch` on a document URL saves the raw binary to a local
tool-results path even when it can't parse it — that path was reusable.
Checked for a command-line PDF text extractor via `which pdftotext` before
assuming one was needed to be installed: `pdftotext` (part of Git Bash's
`mingw64` toolset) was already available. `pdftotext -layout <pdf> <txt>`
produced clean, readable text preserving the document's table layout, then
read normally with the `Read` tool.

**Lesson:** when a tool fails on a file type, check what's already on the
PATH before reaching for a package install — `pdftotext` being bundled
with Git Bash was not obvious in advance but cost one `which` call to
discover.

---

## C3 — A real column was silently missed on the first pass

**Symptom:** after writing what was believed to be the complete 44-field
catalogue, an interactive sanity check (`len(DORA_FIELDS)`) returned 43,
not the expected 45 (the plan's original estimate).

**Root cause:** two things, both worth naming separately. First, the
plan's own estimate of "45 fields" (18 for `B_02.02`) was itself slightly
high — `B_02.02` has 17 real columns in this codebase's data model, not
18, because column `0010` (the arrangement reference number) is shared
with `B_02.01` rather than duplicated as a separate `B_02.02.0010` field;
the plan's estimate hadn't accounted for that overlap. Second, and the
real bug: `b_06.01.0010` ("Function identifier") was genuinely missed
when transcribing `B_06.01`'s column list from the source PDF into
`DORA_FIELDS`.

**Fix:** re-derived the expected per-table counts from the actual EBA
source (5/17/12/10 = 44) rather than trusting the plan's estimate, then
grepped for the specific missing code and added it.

**Lesson:** the project's established discipline of "verify with a real
count/run, don't trust the written plan" (first established in Phase 4's
CHALLENGES.md C5, reused throughout this session) caught this immediately
— a single `len()` check against an independently-derived expected number
is cheap insurance against a transcription miss in a 44-entry manual list.

---

## C4 — Enforcing the real completeness rules changes what "passing" looks like

**Symptom:** not a bug, but a behaviour change worth documenting loudly
so it isn't mistaken for one later. Testing the new rule engine against a
deliberately sparse field set (only 2 of `B_05.01`'s 12 columns filled)
produced 10 `COMPLETENESS_GROUP` fails in one call — a much higher fail
count than the old 7-generic-rule engine would ever have produced for the
same input.

**Root cause:** this is the real EBA rule working as designed. The old
rule set only checked the 2-3 columns this codebase happened to extract;
it had no way to know 9 other real columns existed and were also
required-if-any-sibling-is-filled. The new rule set does, because it's
sourced from EBA's actual business rules rather than approximating them.

**Fix:** no code fix needed — documented here and in `01_overview.md` so
a future reviewer (or the founder demoing the product) isn't surprised by
a document that used to show mostly green suddenly showing many more red
badges after this phase ships. This is the product working *more*
honestly, not worse.

**Lesson:** when replacing an approximation with the real rule, expect the
approximation's failure rate to have been an undercount, not a mismatch —
worth calling out explicitly in the same PR/commit rather than letting a
reviewer discover it independently and read it as a regression.

---

## C5 — Real end-to-end run found two things unit tests couldn't: variable
extraction fill-rate at 44 fields, and years of orphaned validation rows

**Symptom (extraction variance):** re-running the real pipeline against a
real document (AWS's standard customer agreement) through the actual
application code path consistently returned 0 of 44 fields found across
two separate live runs. Standalone repeats of the identical prompt outside
the pipeline (same document, same field catalogue, `temperature=0`)
returned anywhere from 0 to 14 fields found across different calls.

**Root cause:** genuine `gpt-4o-mini` API non-determinism — `temperature=0`
reduces but does not eliminate run-to-run variance in production LLM APIs,
and it becomes more visible at 44 fields than it was at 13 (more places
for the model to hedge to "not present"). Ruled out several more
interesting-looking hypotheses first (a `metadata=`/Langfuse-wrapper bug,
a prompt-caching effect from a reused Langfuse trace name, the "truncated
to 12,000 chars" note in the prompt) by isolating each one — all of them
reproduced both "found many" and "found none" outcomes under otherwise
identical conditions, which is the signature of real variance, not a
deterministic trigger.

**Fix:** none applied — this isn't a bug in Stage 1's code, it's a
property of extracting a much larger field set from a generic vendor
contract (this specific AWS agreement is a real ICT vendor contract but
was never written with DORA RoI fields in mind, so many of the 44 fields
— recovery objectives, criticality reasoning, sub-processor locations —
may genuinely not appear in its text at all, on top of the model's own
variance). Documented here rather than silently absorbed.

**Lesson:** don't chase LLM output variance as if it were a deterministic
code bug without first re-running the *exact same* isolated call multiple
times — a single "found=0" sample looks exactly like a real regression
until a second and third sample show it moving around. Worth revisiting
as real Stage 1 usage data comes in: if fill-rate stays low across many
real (DORA-relevant) contracts, that's a prompt/model tuning task, not
another rule-engine change.

**Symptom (orphaned rows):** the review page showed a "REQUIRED FIELD"
badge on `b_02.01.0030` ("Overarching contractual arrangement reference
number") with the message *"Country of registration of ICT provider is
required but was not extracted"* — a message that belongs to a completely
different field.

**Root cause:** `validation_results` is upserted on
`(document_version_id, field_code, rule_id)` and only ever adds or updates
rows for whatever the *current* `validate_fields()` call actually returns
— it never deletes a row for a `(field_code, rule_id)` pair the current
rule set no longer produces. This test document's `document_version_id`
has been validated repeatedly across this project's full history,
including under at least one earlier, incorrect field-code scheme (predating
the Phase 4 fix) that apparently also used the literal string
`b_02.01.0030` for an unrelated field. That row was never cleaned up, and
Stage 1 coincidentally reintroduced `b_02.01.0030` as a real, current code
— surfacing the old message. Confirmed this is pure historical debris, not
a Stage 1 bug, by checking a field code with no possible history
(`b_05.01.0110`, never extracted before today): it had only clean, current
rows. Separately confirmed the same test document still carries 10
`extraction_results` rows for the pre-Phase-4 `b_01.01.*`/`b_03.01.*` codes
— harmless, since `dora-field-groups.ts`'s `OTHER_GROUP` sentinel already
buckets genuinely-unrecognised codes safely (see Phase 4's CHALLENGES.md
C5-adjacent fix), but a coincidental *code reuse* like this one bypasses
that safety net because the code is valid again, just carrying a stale
row.

**Fix:** not applied to the live dev database — the affected rows are
test artefacts on one heavily-reused document, not a data-integrity risk
for any document validated for the first time under the current code
(which is what every real user's document will do). Left as a documented,
known gap rather than an ad-hoc production-database edit.

**Lesson:** an upsert-only write pattern is fine for a field catalogue
that only ever grows, but silently accumulates dead rows whenever a rule
is removed, a field's rule treatment changes (as several fields' did when
they moved from flat `REQUIRED_FIELD` to `COMPLETENESS_GROUP` in this same
phase), or — worst case — a field code is ever reused for a different
concept. Worth a real fix before Stage 2 adds 10 more tables' worth of
opportunities for this to recur: either delete-then-reinsert per
validation run instead of upsert, or delete any `(field_code, rule_id)`
row not present in the current run's result set as a cleanup step
alongside the upsert.
