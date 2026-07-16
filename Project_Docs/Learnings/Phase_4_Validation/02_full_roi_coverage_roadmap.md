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

## What EvidenceOS covers today — all 14 tables (Stage 1 + 2A + 2B, shipped)

**All 14 real EBA RoI tables now have a path to being populated in an
export.** Six via document extraction (below); the other eight via a new
workspace "Entity profile" settings page (Full RoI Stage 2B, Phase 11) —
`B_01.01`/`B_01.02`/`B_01.03` from a one-time form (your own
organisation's LEI, name, country, type, competent authority, optional
branches), and `B_02.03`/`B_03.01`/`B_03.02`/`B_03.03`/`B_04.01` derived
automatically at export time from that profile plus data already in
`extraction_results` — no second review step, since there's nothing to
review (a company doesn't approve or reject its own LEI). `B_02.03` and
`B_03.03` (intra-group tables) are always empty until real multi-entity
group support exists — see below for why that's still deliberately out
of scope. An export with no entity profile configured yet still produces
every document-level CSV correctly; only the profile-dependent ones come
back empty with a manifest note explaining why.

### The 6 document-extracted tables (Stage 1 + 2A)

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

## The 8 entity-profile tables (Stage 2B, shipped)

`B_01.01`–`B_01.03`, `B_02.03`, `B_03.01`–`B_03.03`, `B_04.01` key off the
**filer's own organisation** (its LEI, its branches, its group structure),
not anything found in a vendor contract — a genuinely different kind of
work from Stages 1/2A, built on this app's first workspace-settings page
(`/dashboard/[workspaceSlug]/settings`, `entity_profiles`/
`entity_branches` tables, migration `0010`).

**The simplification that made this tractable**: for a standalone
financial entity (not part of a group — the primary target per this
product's own positioning doc), 6 of these 8 tables collapse to
near-trivial derivations from one form. `B_01.02` mirrors `B_01.01`
exactly (plus two genuinely new fields, total assets and its currency,
which aren't on `B_01.01`); `B_02.03`/`B_03.03` are always empty (no
intra-group arrangements can exist without a group); `B_03.01`/`B_03.02`/
`B_04.01` auto-derive one row per exported document from the entity
profile plus that document's own `B_02.01`/`B_05.01` fields, already
sitting in `extraction_results`. Only `B_01.01` (one form) and optionally
`B_01.03` (an add-a-branch list) needed genuinely new user input — see
`Project_Docs/Learnings/Phase_11_Full_RoI_Stage2B/01_overview.md`.

**Deliberately still not built**: real multi-entity groups (a second real
`B_01.02` row, real `B_02.03`/`B_03.03` intra-group arrangements,
non-default `B_04.01` branch assignment per contract). Per the product's
own MVP discipline (`Project_Docs/Learnings/00_STACK_DECISIONS.md`
§"solo-founder operability"), building genuine group-hierarchy support
speculatively — before knowing whether a design partner's actual filing
needs it — risks effort on the wrong 80%. The right trigger is a real
customer's filing requirement, not a roadmap slide. If that trigger
arrives, it is scoped to that one gap, not a rebuild — the settings page,
schema, and export derivation logic here don't need to change to add it.

## How to say this honestly in different contexts

**On the landing page / to a prospective customer:** "EvidenceOS covers
all 14 tables of the DORA RoI — 61 fields extracted from your ICT vendor
contracts (validated with the real EBA business rules, 12 rule types, 42
EBA-sourced checks) plus your own organisation's identity, entered once
in workspace settings. The regulator's own bar is 116 individual data
quality checks across the full register; our coverage is the structural
14/14 tables, not yet every one of the 116 checks within them (some are
technical/reception-layer checks outside what a RoI-drafting tool
governs at all)." This is true today and doesn't promise something not
yet built.

**To an investor doing technical diligence:** the numbers above, plus the
staged build history and its trigger conditions for what's still
deliberately deferred (multi-entity groups). The differentiator to lead
with is not "we implement 116 checks" (not true, and not even the right
framing — many of the 116 are file-format/technical checks a drafting
tool doesn't decide) — it's "we correctly understood the real regulatory
structure, built a credible, independently-verifiable path through all
14 tables, and can point to exactly what's still simplified and why,"
which is the harder, more defensible thing to demonstrate and exactly
what `Phase_4_Validation/CHALLENGES.md` C6 and the `Phase_9`/`Phase_10`/
`Phase_11` Full RoI docs document finding and fixing, repeatedly.

**What never to say:** that EvidenceOS runs "116 checks" or is
"116-check compliant" — it isn't, and a technically-diligent reader on
either side (customer compliance team or investor) can and will verify
this against EBA's own public rule set.
