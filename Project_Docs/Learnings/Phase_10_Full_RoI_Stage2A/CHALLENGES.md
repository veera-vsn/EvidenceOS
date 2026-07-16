# Phase 10 (Full RoI Stage 2A) — Challenges

Matching the format every earlier phase's `CHALLENGES.md` uses: symptom,
root cause, fix, lesson.

---

## C1 — A newly-added field would have silently broken an already-shipped
data-model simplification

**Symptom:** while transcribing `B_05.02` and `B_07.01`'s column lists
from EBA's Data Model PDF, both tables' real `0010` column
("Contractual arrangement reference number") got added to
`field_extractor.py` as `b_05.02.0010`/`b_07.01.0010` — a direct,
column-by-column transcription of the source.

**Root cause:** Stage 1 already made a deliberate simplification for the
exact same column on `B_02.02` (which also has a real `0010` per EBA's
schema): don't re-extract the same real-world reference number once per
table, since the export's one-document-one-row model already joins every
template CSV via `document_id`. That reasoning wasn't re-applied when
transcribing the two new tables, because transcription was done
table-by-table from the source PDF rather than cross-checked against the
Stage 1 precedent first.

**Fix:** caught before running any tests, by re-reading Stage 1's own
`CHALLENGES.md` C3 entry (which documents the `B_02.02.0010` decision)
while reviewing the newly-added fields. Removed both new `0010` fields
before implementation continued (19 → 17 new fields).

**Lesson:** when a phase's work directly parallels an earlier phase's
already-shipped simplification, check the precedent *before* transcribing
new data, not after — a design decision recorded once in a CHALLENGES.md
entry needs to be actively re-applied at every future point it recurs,
it doesn't enforce itself. Worth a standing habit: before adding a new
table to this catalogue, scan the existing tables for any column that
appears more than once across EBA's real schema (reference numbers, ID
codes, "type of X" enums) and decide once, explicitly, whether it's
independently extracted or reused.
