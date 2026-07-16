# Full RoI coverage — what "today" covers and what's next

A grounded roadmap from what EvidenceOS validates today to the real
regulatory bar (116 EBA/ESMA/EIOPA data quality checks, confirmed real —
see below), written for two audiences at once: **investors** doing
technical diligence (this is a scoped, understood gap, not an unknown
unknown) and **customers** reading the landing page (an honest "what we
cover today vs. what's next" statement, not an over-claim). Both versions
say the same thing; only the framing differs.

## The real regulatory bar, and where the "116" number comes from

The DORA Register of Information is validated by the EBA against three
layers of checks, confirmed directly from EBA's own published materials
(not a secondary source):

- **Reception/technical checks** (~29) — file format, zip structure,
  filename conventions. Nothing to do with data content.
- **DPM technical checks** (~12) — structural checks against the data
  point model.
- **Business validation rules** (71 total, 58 active as of the 20 March
  2025 rule release — the real content checks: LEI validity, country
  codes, cross-field completeness, numeric ranges).
- **LEI/EUID-specific checks** (~8).

That's ~120 as of the April 2025 rule release — close to, but not
identical to, the **116** figure cited in the [2024 ESAs Dry Run
exercise](https://www.eba.europa.eu/publications-and-media/press-releases/esas-dry-run-exercise-shows-goal-reporting-registers-information-under-digital-operational)
(~1,000 EU financial entities, 6.5% passed every check). EBA
activates/deactivates individual rules over time — it's a maintained rule
set, not a fixed constant, which is itself worth knowing rather than
memorising "116" as gospel.

The full RoI spans **14 EBA DPM tables** — corrected here from an earlier
version of this doc which guessed "16 tables plus B_99.01"; EBA's own
"Data Model for DORA RoI" reference (downloaded and parsed directly —
`eba.europa.eu/.../Data Model for DORA RoI.pdf` — during Full RoI Stage 1)
lists exactly 14, with no `B_99.01`:

| Table | Covers |
|---|---|
| `B_01.01` | The entity maintaining the register |
| `B_01.02` | Entities within the group |
| `B_01.03` | Branches |
| `B_02.01` | Contractual arrangements — general |
| `B_02.02` | Contractual arrangements — specific |
| `B_02.03` | Intra-group contractual arrangements |
| `B_03.01` | Entities signing arrangements to *receive* ICT services |
| `B_03.02` | Providers signing arrangements to *provide* ICT services |
| `B_03.03` | Entities signing intra-group arrangements to *provide* services |
| `B_04.01` | Entities making use of the ICT services |
| `B_05.01` | ICT third-party provider register |
| `B_05.02` | ICT service supply chains (sub-outsourcing) |
| `B_06.01` | Functions identification |
| `B_07.01` | Assessment of the ICT services |

## What EvidenceOS covers today (Full RoI Stage 1 + 2A, shipped)

**61 fields — every real column — across 6 of those 14 tables**:
`B_02.01`/`B_02.02` (contractual arrangements), `B_05.01` (ICT provider
register), `B_06.01` (functions identification), `B_05.02` (ICT service
supply chains / sub-outsourcing), `B_07.01` (assessment of the ICT
services — substitutability, exit planning, audit history). All six are
per-contract data a vendor agreement plausibly discusses, so all six fit
the same extraction → validation → review → export pattern.

**12 deterministic rule types**, most sourced directly from EBA's own
DORA validation-rules workbook rather than hand-approximated:
`REQUIRED_FIELD`, `DATE_FORMAT`, `DATE_LOGIC`, `NOTICE_PERIOD`,
`COUNTRY_CODE`, `LEI_FORMAT`, `CRITICALITY_VALUE`, plus five added in
Stage 1 — `COMPLETENESS_GROUP` (the real EBA "if any column in this set
is filled, all must be" rule, one per table), `CONDITIONAL_REQUIRED`
(extended in Stage 2A to support a rule with more than one trigger
value), `ALLOWED_VALUE` (enum fields checked against EBA's own
dropdown-value workbook), `CURRENCY_FORMAT`, `NON_NEGATIVE_NUMERIC`.
Together these implement **all 42 of the real EBA business rules** that
apply to these 6 tables (34 from Stage 1's four tables + 0 from
`B_05.02`, which genuinely has no EBA business rules at all, + 8 from
`B_07.01`) — confirmed by filtering EBA's validation-rules workbook to
the `DORA` framework: 71 total, 58 active.

Every field code, column list, and rule was verified directly against
EBA's own reference materials (Data Model PDF, validation-rules workbook,
dropdown-values workbook) — not guessed, not taken from third-party
compliance-vendor summaries, several of which were found to directly
contradict each other and the real EBA source during Stage 1. See
`Project_Docs/Learnings/Phase_9_Full_RoI_Stage1/CHALLENGES.md` and
`Project_Docs/Learnings/Phase_10_Full_RoI_Stage2A/CHALLENGES.md`.

**One consequence worth naming plainly:** with the real completeness-group
rules now enforced, a document with only some columns of a table filled in
will show materially more `fail` badges than before — this is the rules
working correctly (EBA's actual bar is genuinely that strict), not a
regression.

## Stage 2B (next): the entity/branch/group registry

The remaining 8 tables — entity/branch/group registry (`B_01.01`–`B_01.03`),
signing entities (`B_03.01`–`B_03.03`), intra-group arrangements
(`B_02.03`), and entities using services (`B_04.01`) — are a genuinely
different kind of work: they key off the **filer's own organisation**
(its LEI, its branches, its group structure), not anything found in a
vendor contract. `B_01.01` is "who are you" — workspace configuration
entered once and reused across every document, not something to extract
from a PDF. That is a different UX pattern (a workspace "Entity Profile"
settings surface) from the per-document upload-and-review flow every
table so far has used.

**The simplification that makes this tractable**: for a standalone
financial entity (not part of a group — the primary target per this
product's own positioning doc), most of these 8 tables collapse to
near-trivial derivations from one entity-profile form: `B_01.02` mirrors
`B_01.01` exactly, `B_02.03`/`B_03.03` are always empty (no intra-group
arrangements without a group), and `B_03.01`/`B_03.02`/`B_04.01`
auto-derive from the entity profile plus data already in
`extraction_results`. Only `B_01.01` (one form) and optionally `B_01.03`
(an add-a-branch list) need genuinely new input. Full multi-entity/group
support stays deferred pending real signal — see the design sketch this
plan's Stage 2B section left for the next implementation pass.

**Not started without real customer signal.** Per the product's own MVP
discipline (`Project_Docs/Learnings/00_STACK_DECISIONS.md`
§"solo-founder operability"), building out 8 more tables' worth of
relational entity/group data speculatively — before knowing whether
design partners' actual annual filings need real multi-entity groups —
risks a lot of effort on the wrong 80%. The right trigger is a real
customer's filing requirement, not a roadmap slide.

## How to say this honestly in different contexts

**On the landing page / to a prospective customer:** "EvidenceOS covers
the ICT vendor contract layer of the DORA RoI — 61 fields across 6 real
EBA templates, validated with the real EBA business rules for those
tables (12 rule types, 42 EBA-sourced checks). The regulator's own bar is
116 checks across the full 14-table register; we're staged toward that,
starting with the highest-value layer first." This is true today and
doesn't promise something not yet built.

**To an investor doing technical diligence:** the numbers above, plus the
explicit staged plan and its trigger conditions. The differentiator to
lead with is not "we implement 116 checks" (not true yet) — it's "we
correctly understood the real regulatory structure and scoped a credible,
independently-verifiable path to it," which is the harder, more defensible
thing to demonstrate and exactly what `Phase_4_Validation/CHALLENGES.md`
C6 and the `Phase_9`/`Phase_10` Full RoI docs document finding and fixing,
repeatedly.

**What never to say:** that EvidenceOS runs "116 checks" or is
"116-check compliant" — it isn't, and a technically-diligent reader on
either side (customer compliance team or investor) can and will verify
this against EBA's own public rule set.
