# Phase 6 — xBRL-CSV Export

## What we built

A workspace-wide export: one zip containing a CSV per ESMA template
(RT.02.01/RT.02.02/RT.05.01/RT.06.01 — corrected from an earlier,
incorrect RT.01.01/RT.02.01/RT.03.01 scheme, see
`Project_Docs/Learnings/Phase_4_Validation/CHALLENGES.md`), an
evidence-trail `evidence_audit_trail.csv`, and a
`disclaimer_manifest.txt` disclaimer. Only documents whose latest version is both
validated and **fully reviewed** are included — every one of the 13
fields must carry a reviewer decision (approve/edit/reject) before that
document contributes a row to the export.

## Why it matters

This is the last stop in the pipeline: `Upload → OCR → Extraction →
Validation → Human review → Export`. Everything before this phase
produces and checks values; this phase is where those values leave the
tool. Per `CLAUDE.md` §7, nothing auto-finalises — this export is the
concrete enforcement of that rule at the very last gate, not just the
review workflow.

## Two scope decisions, and why

**Fidelity — an honest structured draft, not a taxonomy-conformant
filing.** A real xBRL-CSV/OIM-CSV package requires a licensed EBA/ESMA
DPM taxonomy artefact and an XBRL processor (e.g. Arelle) to validate
against — neither exists in this repo, and the 13-field `DORA_FIELDS`
catalogue is already a deliberate MVP subset of the real RoI's much
larger field set. Building genuine conformance now isn't achievable, and
claiming it would be actively misleading. This matches the product's own
PRD non-goal: *"Not automatically filing regulatory submissions."*
`manifest.txt` carries this disclaimer explicitly in every export, and
the Export page repeats it above the download button.

**Scope — whole workspace, not per document.** One export aggregates
every fully-reviewed document into the 3 template CSVs, one row per
document per template. A real DORA RoI is a firm-wide register of every
ICT arrangement, not a single contract — a per-document download would
have been simpler to build but wouldn't match what the output is actually
for.

## What real taxonomy conformance would require (future work, not built)

Documented here so a future phase doesn't have to rediscover this:

- A licensed EBA/ESMA DORA DPM/taxonomy package (the actual concept
  definitions, not a mnemonic scheme like `b_02.01.0010`).
- An XBRL processor — e.g. **Arelle** — to validate the generated report
  against that taxonomy before it could be called conformant.
- A real `report.json`/`reportPackage` manifest per the xBRL-CSV
  specification, replacing the current plain-text `manifest.txt`.
- Dimensional metadata per datapoint (entity, period, unit, scenario
  dimensions the taxonomy requires) — the current export has none of
  this; every cell is a bare string.
- Full RoI field coverage beyond the current 13-field MVP subset — the
  real Register of Information has far more fields across more RT
  templates than this product extracts today.

None of this blocks the product's current value (structured, reviewed,
evidence-backed data ready for a compliance team's own final submission
step) — it's what would be needed to go from "draft aid" to "the filing
itself."

## Files introduced / changed

| File | Purpose |
|---|---|
| `apps/api/app/pipeline/export.py` | Template grouping, eligibility gate, CSV/manifest builders, zip assembly |
| `apps/api/tests/test_export.py` | Unit tests for every pure function in export.py |
| `apps/api/app/pipeline/router.py` | `GET /pipeline/workspaces/{id}/export` |
| `apps/web/.../export/page.tsx` | Ready/not-ready summary before download |
| `apps/web/.../export/download/route.ts` | Authenticated download proxy |
| `apps/web/.../layout.tsx` | "Export" nav link |

## Key design decisions

**No persistence.** The zip is rebuilt fully in-memory on every request
from `extraction_results` and `field_reviews` — no `exports` table, no
Storage write path. Regeneration is cheap and those two tables are
already the source of truth, so persisting a copy would buy nothing for
correctness. An older, unimplemented planning doc
(`Project_Docs/db_schema.md.txt`, `api_spec.md.txt`) sketched a generic
`exports`/`export_files` table under a different, superseded
phase-numbering scheme — this phase doesn't adopt it. "Export history"
(a persisted record of what was downloaded and when) is a reasonable
future enhancement, explicitly out of scope here.

**Eligibility is server-authoritative, client-display-only.** "Fully
reviewed" — every extracted field has *any* `field_reviews` row,
approved/edited/rejected all counting — is recomputed from the database
inside `export.py`'s `determine_export_eligibility()` every time the zip
is built. The Export page's own copy of this same logic (in TypeScript)
exists purely so the user isn't surprised by an empty or partial
download; if a document's review state changes between page load and
download click, the Python endpoint's fresh computation is what actually
decides what's in the file, not the page the user was looking at.

**Reviewer identity, not a raw UUID.** `sources.csv` resolves each
`field_reviews.reviewed_by` to a `profiles.display_name` (falling back to
the UUID only if no profile exists) via one small extra query. This is
the cheap addition that makes the evidence trail deliver on the product's
own pitch — "every RoI cell tied to a source document with confidence and
reviewer identity" — instead of leaving an opaque ID a reader would have
to look up by hand.

## Interview Q&A

**Q: Why not persist each export as a row so a firm can see what it
submitted historically?**
A: Nothing in this MVP needs it yet, and the underlying data
(`extraction_results`, `field_reviews`) is immutable enough that the
export is a pure function of workspace state at request time — building
persistence now would be scope creep against unclear requirements. If
compliance teams later need a legal record of "what did we generate on
date X," that's a deliberate, scoped addition (likely the older
`exports` table design, revisited with the benefit of what this phase
actually built), not a default to reach for early.

**Q: Why does an approved-but-never-extracted field still block nothing,
while an unreviewed field blocks the whole document?**
A: A reviewer approving a blank field is a real, deliberate signal — "I
looked, there's genuinely nothing here for this field." A field with no
review row at all means nobody has looked yet. Only the second case
should hold up an export; the first is exactly what human-in-the-loop
review is supposed to produce.
