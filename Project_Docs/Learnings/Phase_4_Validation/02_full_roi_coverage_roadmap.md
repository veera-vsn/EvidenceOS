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
- **Business validation rules** (~71) — the real content checks: LEI
  validity, country codes, cross-field completeness, numeric ranges.
- **LEI/EUID-specific checks** (~8).

That's ~120 as of the April 2025 rule release — close to, but not
identical to, the **116** figure cited in the [2024 ESAs Dry Run
exercise](https://www.eba.europa.eu/publications-and-media/press-releases/esas-dry-run-exercise-shows-goal-reporting-registers-information-under-digital-operational)
(~1,000 EU financial entities, 6.5% passed every check). EBA
activates/deactivates individual rules over time — it's a maintained rule
set, not a fixed constant, which is itself worth knowing rather than
memorising "116" as gospel.

The full RoI spans **16 EBA DPM tables** (`B_01.01` through `B_07.01`,
plus `B_99.01`), covering: the reporting entity itself, branches, group
structure, contractual arrangements (2 tables), signing entities (3
tables), the ICT third-party provider register, sub-outsourcing chains,
functions and their criticality assessment, and cost/impact assessments.

## What EvidenceOS covers today

13 fields across **4 of those 16 tables** — `B_02.01`/`B_02.02`
(contractual arrangements), `B_05.01` (ICT provider register), `B_06.01`
(functions identification) — the tables that matter most for the
single-highest-value use case: turning an ICT vendor contract into
structured, evidence-backed RoI data.

7 deterministic rule types (required-field, date format, date logic,
notice period, country code, LEI format, criticality-term) producing 19
checks total across those 13 fields. Every field code was verified
directly against EBA's own "Annotated Table Layout — DORA 4.0" reference
— see `Project_Docs/Learnings/Phase_4_Validation/CHALLENGES.md` C6 for
the correction this required (an earlier version of this catalogue used
invented, incorrect table codes).

## Stage 1 (near-term): real EBA rules for our existing 4 tables

Of the ~71 real EBA business validation rules, **34 apply to the 4 tables
we already extract from** — but almost all of them are *multi-column
mutual-completeness checks*: "if any of these 8 provider-registry columns
are filled in, this 9th one must be too." Our current extraction only
pulls 2-3 of each table's ~8-12 real columns, so these rules can't be
implemented against what we have today without producing false failures
against data we simply don't collect.

**What this needs:** extracting the additional columns each table
actually has — e.g. `B_05.01` (ICT provider register) has 12 real columns
(additional identifier codes, parent-undertaking LEI, annual expense,
currency) and we extract 3; `B_02.02` (contractual arrangements, specific
info) has 18 columns (termination reason, country of service provision,
data storage/processing locations, reliance level) and we extract 8.

This is bounded, well-understood work — no new tables, no new UI
concepts, just more columns per document within the review flow that
already exists. Once done, the real completeness rules for these 4
tables become honestly implementable.

## Stage 2 (longer-term): the rest of the RoI

The other 12 tables — entity/branch registry, group structure,
sub-outsourcing chains, cost assessments — are a genuinely bigger
expansion: new extraction targets the LLM has never been prompted for,
new review UI sections, and in some cases data that doesn't come from a
vendor contract at all (e.g. the filer's own entity metadata is workspace
configuration, not something to extract from a PDF).

**Deliberately not started without real customer signal.** Per the
product's own MVP discipline (`Project_Docs/Learnings/00_STACK_DECISIONS.md`
§"solo-founder operability"), building out 12 more tables speculatively —
before knowing whether design partners' actual annual filings need them
beyond the contractual-arrangements/provider/outsourcing core — risks a
lot of effort on the wrong 80%. The right trigger for Stage 2 is a real
customer's filing requirement, not a roadmap slide.

## How to say this honestly in different contexts

**On the landing page / to a prospective customer:** "EvidenceOS covers
the ICT vendor contract layer of the DORA RoI — 13 fields across 4 real
EBA templates, validated with 7 rule types. The regulator's own bar is
116 checks across the full register; we're staged toward that, starting
with the highest-value layer first." This is true today and doesn't
promise something not yet built.

**To an investor doing technical diligence:** the numbers above, plus the
explicit two-stage plan and its trigger conditions. The differentiator to
lead with is not "we implement 116 checks" (not true yet) — it's "we
correctly understood the real regulatory structure and scoped a credible
path to it," which is the harder, more defensible thing to demonstrate
and exactly what `Phase_4_Validation/CHALLENGES.md` C6 documents finding
and fixing.

**What never to say:** that EvidenceOS runs "116 checks" or is
"116-check compliant" — it isn't, and a technically-diligent reader on
either side (customer compliance team or investor) can and will verify
this against EBA's own public rule set.
