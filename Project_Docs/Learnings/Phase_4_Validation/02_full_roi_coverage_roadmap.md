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

## What EvidenceOS covers today (Full RoI Stage 1, shipped)

**44 fields — every real column — across 4 of those 14 tables**:
`B_02.01`/`B_02.02` (contractual arrangements), `B_05.01` (ICT provider
register), `B_06.01` (functions identification) — the tables that matter
most for the single-highest-value use case: turning an ICT vendor
contract into structured, evidence-backed RoI data.

**12 deterministic rule types**, most sourced directly from EBA's own
DORA validation-rules workbook rather than hand-approximated:
`REQUIRED_FIELD`, `DATE_FORMAT`, `DATE_LOGIC`, `NOTICE_PERIOD`,
`COUNTRY_CODE`, `LEI_FORMAT`, `CRITICALITY_VALUE`, plus five added in
Stage 1 — `COMPLETENESS_GROUP` (the real EBA "if any column in this set
is filled, all must be" rule, one per table), `CONDITIONAL_REQUIRED`,
`ALLOWED_VALUE` (enum fields checked against EBA's own dropdown-value
workbook), `CURRENCY_FORMAT`, `NON_NEGATIVE_NUMERIC`. Together these
implement **all 34 of the real EBA business rules** that apply to these 4
tables (confirmed by filtering EBA's validation-rules workbook to the
`DORA` framework: 71 total, 58 active, 34 touching `B_02.01`/`B_02.02`/
`B_05.01`/`B_06.01`).

Every field code, column list, and rule was verified directly against
EBA's own reference materials (Data Model PDF, validation-rules workbook,
dropdown-values workbook) — not guessed, not taken from third-party
compliance-vendor summaries, several of which were found to directly
contradict each other and the real EBA source during this work. See
`Project_Docs/Learnings/Phase_9_Full_RoI_Stage1/CHALLENGES.md`.

**One consequence worth naming plainly:** with the real completeness-group
rules now enforced, a document with only some columns of a table filled in
will show materially more `fail` badges than before — this is the rules
working correctly (EBA's actual bar is genuinely that strict), not a
regression.

## Stage 2 (next): the rest of the RoI

The other 10 tables — entity/branch/group registry (`B_01.01`–`B_01.03`),
signing entities (`B_03.01`–`B_03.03`), intra-group arrangements
(`B_02.03`), entities using services (`B_04.01`), service chains
(`B_05.02`), and the ICT-services risk assessment (`B_07.01`) — are a
genuinely bigger expansion: new extraction targets the LLM has never been
prompted for, new review UI sections, and in some cases data that doesn't
come from a vendor contract at all. `B_01.01`–`B_01.03` specifically
capture the **filer's own organisation** (its LEI, its branches, its group
structure) — workspace configuration entered once and reused across every
document, not something to extract from a PDF. That is a different UX
pattern (a workspace "Entity Profile" settings surface) from the
per-document upload-and-review flow every table so far has used, and
deserves its own dedicated planning pass before implementation starts.

**Not started without real customer signal.** Per the product's own MVP
discipline (`Project_Docs/Learnings/00_STACK_DECISIONS.md`
§"solo-founder operability"), building out 10 more tables speculatively —
before knowing whether design partners' actual annual filings need them
beyond the contractual-arrangements/provider/functions core — risks a lot
of effort on the wrong 80%. The right trigger for Stage 2 is a real
customer's filing requirement, not a roadmap slide.

## How to say this honestly in different contexts

**On the landing page / to a prospective customer:** "EvidenceOS covers
the ICT vendor contract layer of the DORA RoI — 44 fields across 4 real
EBA templates, validated with the real EBA business rules for those
tables (12 rule types, 34 EBA-sourced checks). The regulator's own bar is
116 checks across the full 14-table register; we're staged toward that,
starting with the highest-value layer first." This is true today and
doesn't promise something not yet built.

**To an investor doing technical diligence:** the numbers above, plus the
explicit two-stage plan and its trigger conditions. The differentiator to
lead with is not "we implement 116 checks" (not true yet) — it's "we
correctly understood the real regulatory structure and scoped a credible,
independently-verifiable path to it," which is the harder, more defensible
thing to demonstrate and exactly what `Phase_4_Validation/CHALLENGES.md`
C6 and `Phase_9_Full_RoI_Stage1/` document finding and fixing, twice.

**What never to say:** that EvidenceOS runs "116 checks" or is
"116-check compliant" — it isn't, and a technically-diligent reader on
either side (customer compliance team or investor) can and will verify
this against EBA's own public rule set.
