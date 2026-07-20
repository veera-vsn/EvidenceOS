# EvidenceOS

**An AI-powered evidence and validation copilot for the DORA Register of Information (RoI) — EU Regulation 2022/2554, Article 28(3).**

EvidenceOS turns ICT vendor contracts into a structured, evidence-backed, filing-ready draft of the DORA Register of Information: **Upload → Extract → Normalize → Validate → Recommend → Review → Export**. Every AI-extracted value carries a confidence score and a source citation. Every compliance decision is made by a deterministic, testable rule — never by an LLM. Every field is approved, corrected, or rejected by a named human before it can leave the system. Nothing auto-finalises, nothing auto-files.

> Full product context lives in [`Project_Docs/`](./Project_Docs/) (PRD, SDD, domain model) and [`Project_Docs/Learnings/`](./Project_Docs/Learnings/) (a phase-by-phase build log — what was built, why, what broke, and how it was fixed, written for both a stakeholder and an engineer doing a code review).

---

## Table of contents

1. [The problem](#the-problem)
2. [What EvidenceOS actually does](#what-evidenceos-actually-does)
3. [Status — what's built, right now](#status--whats-built-right-now)
4. [Architecture](#architecture)
5. [Regulatory coverage — the real numbers](#regulatory-coverage--the-real-numbers)
6. [Engineering deep dives](#engineering-deep-dives)
7. [Interview Q&A](#interview-qa)
8. [Future work](#future-work)
9. [Repository layout](#repository-layout)
10. [Quick start (local dev)](#quick-start-local-dev)
11. [Deployment](#deployment)
12. [Non-goals](#non-goals)
13. [Licence](#licence)

---

## The problem

Under DORA, EU financial entities (banks, payment institutions, insurers, investment firms, and more) must submit an annual — and quarterly-updated — Register of Information to their national competent authority, listing every ICT third-party service provider, every contractual arrangement, and a risk assessment of each. It's a real, machine-validated regulatory filing: the EBA runs **116 automated data-quality checks** against every submission.

In the **2024 EU-wide ESAs Dry Run exercise** (~1,000 firms, real data), only **6.5% passed every check** ([EBA press release, official source](https://www.eba.europa.eu/publications-and-media/press-releases/esas-dry-run-exercise-shows-goal-reporting-registers-information-under-digital-operational)). Most firms today build this register by hand in spreadsheets — no source traceability, no confidence signal, no way to know which of the 116 checks a filing will fail until the regulator runs them.

**The wedge**: turn the highest-effort part of this — reading hundreds of ICT vendor contracts and extracting the same handful of structured fields from each — into a pipeline that extracts with AI, validates with real regulator rules, and puts a human in the loop before anything is exported.

---

## What EvidenceOS actually does

```
Upload  →  OCR  →  AI Extraction  →  Validation  →  Recommend  →  Human Review  →  Export
 (PDF/      (text)   (GPT-4o-mini,      (deterministic,   (RAG,         (approve/          (draft
 DOCX/               confidence-        rule-based,       not yet       edit/reject         xBRL-CSV,
 XLSX/               scored per         no LLM)           built —       per field,          full audit
 CSV)                field)                                see below)    named reviewer)     trail)
```

- **Upload** — drag-and-drop, direct browser → Supabase Storage upload (no file streams through the API).
- **OCR** — pdfplumber (PDF), python-docx, openpyxl, or plain CSV parsing, dispatched by file type.
- **AI Extraction** — GPT-4o-mini reads the document text and returns a JSON object with every DORA field it can find, each with a 0.0–1.0 confidence score. Every call is traced in Langfuse (EU region) with tokens, cost, and latency.
- **Validation** — a pure, deterministic rule engine (**zero LLM calls**) checks every extracted value against the real EBA business rules: required fields, date logic, LEI format, ISO country codes, enum values, and multi-column completeness rules sourced directly from EBA's own validation-rules workbook.
- **Recommend** — not yet built. See [Future work](#future-work).
- **Human Review** — a compliance analyst sees every field with its confidence score and validation badges, and approves, edits, or rejects it. A rejection requires a written reason (a permanent audit record).
- **Export** — a zip of CSVs, one per EBA template, plus a full evidence-trail CSV (source document, extracted value, confidence, reviewer, timestamp for every cell) and a plain-text disclaimer manifest. This is a **structured draft aid**, not a taxonomy-conformant XBRL-CSV filing — see [Non-goals](#non-goals).

**The one rule that shapes every other design decision**: *AI extracts and (eventually) recommends; deterministic code validates; a human decides.* An LLM is never the thing that marks a field compliant.

---

## Status — what's built, right now

| Phase | What | Status |
|---|---|---|
| 0 – 0.5 | Scaffold, auth, Supabase schema + RLS | ✅ |
| 1 | Document upload + storage | ✅ |
| 2 | OCR worker | ✅ |
| 3 | AI field extraction + Langfuse observability | ✅ |
| 4 | Deterministic validation engine | ✅ |
| 5 | Human review workflow | ✅ |
| 6 | Draft xBRL-CSV export | ✅ |
| — | UI/UX redesign — compact, "Anthropic-style," mobile-responsive | ✅ |
| 7 | Deployment — AWS EC2 (API) + Vercel (web) | ✅ (staging + production live) |
| 4→9 | **Field-code mapping correction** — real EBA DPM 4.0 table codes | ✅ |
| 9 | **Full RoI Stage 1** — every real column + rule for the 4 core contract tables | ✅ |
| 10 | **Full RoI Stage 2A** — 2 more tables (sub-outsourcing, risk assessment) | ✅ |
| 11 | **Full RoI Stage 2B** — entity profile, closes all 14 real EBA RoI tables | ✅ |
| — | **Data-integrity fix** — stale extraction/validation rows on re-run | ✅ |
| 12 | **Application-layer encryption** — AES-256-GCM on document text + extracted fields, on top of Supabase's disk-level encryption | ✅ |
| 13 | **Design system consolidation + public blog** — shared `components/ui` primitives, a reusable frontend-design skill, and a public MDX blog with launch articles | ✅ |
| 7 (RAG) | Retrieval-augmented evidence for Review | 🗺️ planned, not started |

77 backend tests passing, `ruff` clean, `mypy`-strict TypeScript (`npx tsc --noEmit` clean). Every phase above shipped with a real end-to-end verification pass (not just unit tests) against the live Supabase project — see [Engineering deep dives](#engineering-deep-dives) for what that caught.

Full detail on every phase, including everything that went wrong and how it got fixed: [`Project_Docs/Learnings/`](./Project_Docs/Learnings/).

---

## Architecture

```
┌─────────────────────┐        ┌──────────────────────┐        ┌─────────────────────┐
│  apps/web             │        │  apps/api               │        │  Supabase (EU)         │
│  Next.js 16, App Router│◄──────►│  FastAPI, Python 3.13   │◄──────►│  Postgres + Storage +  │
│  React 19, TS strict   │  REST  │  Pydantic v2, async      │ REST/  │  Auth + RLS            │
│  Tailwind v4            │        │  BackgroundTasks         │ RPC    │  (Frankfurt/Ireland)   │
└─────────────────────┘        └──────────────────────┘        └─────────────────────┘
        │                                 │                                │
        │ direct upload                   │ OpenAI (GPT-4o-mini)           │ Row-Level Security:
        ▼                                 ▼                                │ every table scoped to
  Supabase Storage                  Langfuse (EU)                          │ workspace membership,
  (signed URLs)                     LLM observability                      │ enforced at the DB —
                                                                             │ not just the API layer
```

**Frontend — Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4.** Server Components by default (auth-gated dashboards resolve on the server, no flash of unauthenticated content); the only Client Components are the ones that genuinely need browser state (the upload zone, the field-review card's approve/edit/reject controls, the mobile sidebar drawer). A small shared `components/ui/` layer (`Logo`, `Button`, `Input`, `Alert`, `Badge`, `Card`, `EmptyState`, `Skeleton`) on a warm-neutral design-token system (`globals.css`), styled to read as calm/enterprise rather than "modern SaaS," deliberately modelled on claude.ai's own product interface — see [`Phase_13_Design_System_and_Blog/`](./Project_Docs/Learnings/Phase_13_Design_System_and_Blog/) for why that layer was consolidated and the reusable design skill it was built from.

**Backend — FastAPI, Python 3.13, Pydantic v2.** A modular monolith, not microservices — one deploy target, one process to debug, module boundaries enforced by folder structure (`app/pipeline/`) rather than network calls. Long-running work (OCR, extraction, validation) runs in a `BackgroundTasks` job so the trigger endpoint returns instantly; no Celery/Redis yet — a Postgres-backed job table (`pipeline_runs`/`pipeline_run_documents`) gives at-least-once semantics with retry/status tracking, which is most of what a real queue gives you at this volume.

**Database — Supabase Postgres, EU region.** Row-Level Security is the actual security boundary — every table's read/write policies are enforced by Postgres itself, not just checked in application code, so an API bug can't leak cross-workspace data. All writes from the pipeline worker use a service-role client (a trusted internal process); all writes from the Next.js app go through the user's own session, gated by RLS. Migrations are plain, hand-written SQL files (`supabase/migrations/`), not ORM-generated — a regulated-domain schema should be reviewable by a human without decoding a diff.

**Why this stack**: EU-only data residency (DORA + GDPR), and "operable by one engineer without a DevOps team" were the two constraints that drove every choice. Full reasoning, including the alternatives rejected and why: [`Project_Docs/Learnings/00_STACK_DECISIONS.md`](./Project_Docs/Learnings/00_STACK_DECISIONS.md) — note that doc's OCR/LLM/deployment-vendor sections predate several real decisions made during actual build (Azure Document Intelligence → PyMuPDF/python-docx/openpyxl; Claude Sonnet+Haiku split → GPT-4o-mini; Fly.io/Railway → AWS EC2), each documented with why in the relevant phase's `CHALLENGES.md`. A stack-decisions doc written on day one records the best choice *then*, not a permanent fact — worth knowing as a general lesson, not just a footnote here.

---

## Regulatory coverage — the real numbers

The DORA Register of Information has **14 real tables** in EBA's own DPM 4.0 data model (confirmed directly from EBA's "Data Model for DORA RoI" reference document — not a secondary source, not guessed). EvidenceOS has a path to populating all 14:

| Coverage | Tables | How |
|---|---|---|
| **6 tables, document-extracted** | `B_02.01`/`B_02.02` (contractual arrangements), `B_05.01` (ICT provider register), `B_06.01` (functions), `B_05.02` (sub-outsourcing), `B_07.01` (risk assessment) | AI-extracted from the vendor contract, deterministically validated, human-reviewed |
| **8 tables, entity-profile-derived** | `B_01.01`–`B_01.03` (the filer's own identity/branches), `B_02.03`, `B_03.01`–`B_03.03`, `B_04.01` (signing entities, service usage) | 2 tables from a one-time workspace settings form; 6 tables auto-derived at export time from that form plus data already extracted — no second review step, because there's nothing to review (a company doesn't approve its own LEI) |

**61 real fields** (every real column of the 6 document-extracted tables — not a curated subset), validated by **12 deterministic rule types** implementing **42 of the real EBA business validation rules** (of 71 total, 58 active, as published in EBA's own DORA validation-rules workbook). Every field code, column, and rule was verified against EBA's own primary-source materials — the Data Model PDF, the validation-rules workbook, the dropdown-values workbook — downloaded and parsed directly with Python, not taken from secondary compliance-vendor summaries (two of which were found to directly contradict each other and the real EBA source during this work — see [Engineering deep dives](#engineering-deep-dives)).

**What's honestly still simplified**: real multi-entity/group support (a firm with subsidiaries, intra-group arrangements, non-default branch routing) is deliberately not built. For the product's stated target — a standalone mid-sized EU financial entity — this doesn't matter; the 8 entity-profile tables above already handle that case correctly. Building genuine group-hierarchy support before a real customer asks for it would be effort spent on the wrong 80%. If that signal arrives, the schema and export logic here don't need a rewrite to add it — just new rows.

**What "116 checks" honestly means for this product**: EvidenceOS implements the real business-validation-rule layer for the 6 tables it extracts from (42 of the ~71 such rules that exist across all 14 tables) — not the reception/file-format layer (~29 checks) or the DPM structural layer (~12 checks), which are about the *filing package*, not the *data*, and aren't something a RoI-drafting tool decides. "116 checks" is the regulator's number for the whole submission; it is never claimed as this product's own compliance score.

Full sourcing methodology and the running total: [`Project_Docs/Learnings/Phase_4_Validation/02_full_roi_coverage_roadmap.md`](./Project_Docs/Learnings/Phase_4_Validation/02_full_roi_coverage_roadmap.md).

---

## Engineering deep dives

The parts of this build worth walking an interviewer through in detail — each links to the full write-up.

### 1. Found and fixed a wrong regulatory data model, by going to the primary source

An early version of the field catalogue used invented EBA table codes (`RT.01.01`/`RT.03.01`-style) that didn't match any real EBA table. Caught by cross-checking against EBA's own "Annotated Table Layout" reference workbook (downloaded and parsed with `openpyxl`, not guessed). Fixed by relabelling every field to its real code (`B_02.01`/`B_02.02`/`B_05.01`/`B_06.01`) and rebuilding the validator's field constants to match. This is the kind of bug that's invisible until you check against the regulator's own document — and the same discipline (primary source, not a blog) caught two more real conflicts later in the build, including two compliance-vendor blogs that gave *opposite* meanings for the same table code.
→ [`Phase_4_Validation/CHALLENGES.md`](./Project_Docs/Learnings/Phase_4_Validation/CHALLENGES.md) (C6), [`Phase_9_Full_RoI_Stage1/CHALLENGES.md`](./Project_Docs/Learnings/Phase_9_Full_RoI_Stage1/CHALLENGES.md) (C1)

### 2. Collapsed 34 near-duplicate EBA rules into one reusable construct

EBA's real validation rules mostly take one shape: "if any column in this set is filled in, every column in the set must be" — expressed by EBA as ~30 individually rotated per-column rules (one active rule per column, each checking the others). Implementing that literally would have meant ~30 nearly-identical Python functions. Instead, built a single `_check_completeness_group()` that takes a declarative list of field-code groups (data, not code) and evaluates the same logic once per table. Same for a second shape (conditional requirement — "if field A has value X, field B becomes required") extended mid-build to support multiple trigger values without changing its call sites.
→ [`Phase_9_Full_RoI_Stage1/01_overview.md`](./Project_Docs/Learnings/Phase_9_Full_RoI_Stage1/01_overview.md)

### 3. The design insight that made the last 8 tables affordable

The remaining 8 EBA tables all key off the filer's *own* organisation, not contract data — a genuinely different kind of work needing a new UI surface. Building full multi-entity/group support for this would have been a large, speculative lift. The insight that unlocked it cheaply: for a *standalone* entity (the actual target customer), 6 of the 8 tables are mechanically derivable from **one** simple form — `B_01.02` mirrors the entity's own identity exactly, two tables are provably always empty without a group, and three more auto-derive one row per contract from data the pipeline already extracted. Only one form and an optional branch list needed to be built. This is the same "what does the *actual* target customer need, not the fully general case" reasoning applied to schema design, not just feature scoping.
→ [`Phase_11_Full_RoI_Stage2B/01_overview.md`](./Project_Docs/Learnings/Phase_11_Full_RoI_Stage2B/01_overview.md)

### 4. A real data-integrity bug, found only by running the system for real

Unit tests all passed; the bug only showed up when re-running the actual pipeline against a real, previously-processed document: a field showed a validation error message that belonged to a *completely different field*. Root cause: `extraction_results`/`validation_results` were `upsert`ed on their unique keys, which only ever adds or updates rows for the *current* run's output — a row for a field or rule the current code no longer produces lingers forever, and can resurface with a stale, wrong message if a field code is ever coincidentally reused (which happened, across two different historical catalogue versions of this same codebase). Fixed by switching both write paths to delete-then-insert. This is the kind of bug that a green test suite will never catch, because the bug is specifically about state left over from a *previous* run — it only exists in a live, evolving database.
→ [`Phase_9_Full_RoI_Stage1/CHALLENGES.md`](./Project_Docs/Learnings/Phase_9_Full_RoI_Stage1/CHALLENGES.md) (C5)

### 5. Verifying a mobile UI when the obvious tool doesn't work

Needed to verify a new mobile drawer sidebar and a responsive nav collapse, but the browser-automation environment's `resize_window` tool changed the window's outer dimensions without ever changing `window.innerWidth` — the value every CSS media query actually keys off. Diagnosed by directly checking `{innerWidth, outerWidth}` after a resize call. Worked around it by injecting a temporary stylesheet plus targeted class overrides that force the specific responsive rules under test to apply regardless of the real viewport width, screenshotting, then reverting — proving the breakpoint logic and component state are correct without needing a genuinely narrow viewport. Documented as a real tooling gap, not silently worked around and forgotten.
→ [`Phase_9_Full_RoI_Stage1/CHALLENGES.md`](./Project_Docs/Learnings/Phase_9_Full_RoI_Stage1/CHALLENGES.md) (C1, referenced from the redesign phase)

### 6. Real infrastructure, not a toy deploy

Backend deployed to a bare AWS EC2 instance by hand — IAM least-privilege setup, nginx reverse proxy, systemd service, Let's Encrypt via `sslip.io` (no owned domain), `tar`-over-SSH redeploys (deliberately not git-based, so the server never needs GitHub credentials). Every real problem hit along the way is logged with root cause and fix: orphaned `certbot` processes holding a lock file, Vercel's first deploy always targeting Production regardless of intent, a Windows-specific stuck-TCP-listener issue that recurred twice across sessions.
→ [`Phase_7_Deployment/`](./Project_Docs/Learnings/Phase_7_Deployment/)

---

## Interview Q&A

**Q: Why is validation deterministic code and not an LLM call?**
A: DORA compliance is a pass/fail regulatory decision. An LLM is non-deterministic (confirmed directly during this build — the same prompt against the same document, `temperature=0`, returned meaningfully different extraction results across repeated calls) and unauditable in the way a regulator or auditor needs. The rule engine in `apps/api/app/pipeline/validator.py` is pure Python, fully unit-tested, and every rule traces to a specific EBA validation rule ID. The LLM's job stops at "here's a candidate value and how confident I am" — it never decides compliance.

**Q: What happens when the AI gets something wrong?**
A: It's expected to, and the product is built around that rather than around AI accuracy. Every field shows its confidence score and every validation badge next to it; a human reviewer approves, edits, or rejects — a rejection requires a written reason, which becomes a permanent audit-trail record. Nothing reaches the export step without a human decision on every field.

**Q: How did you verify 116 checks / regulatory accuracy claims rather than just asserting them?**
A: By downloading EBA's own reference materials — the Data Model PDF, the DORA validation-rules workbook (Excel, parsed with `openpyxl`), the dropdown-values workbook — and parsing them directly with Python rather than trusting secondary sources. This caught a real bug (wrong table codes, early in the build) and caught two compliance-vendor blog posts that directly contradicted each other and the real EBA source. The actual coverage numbers on this README (61 fields, 42 rules, 14/14 tables) are independently re-derivable from those same primary sources, not asserted.

**Q: Why Supabase instead of rolling your own Postgres + auth + storage?**
A: Row-Level Security is the real security boundary for a multi-tenant regulated product — Supabase gives that natively bundled with Postgres, Auth, and Storage in one EU-hosted service. For a solo-founder-operable stack, collapsing five vendor relationships (DB, auth, storage, RLS, backups) into one was worth more than any per-byte cost saving from self-hosting.

**Q: What was the hardest bug to find?**
A: The stale-row data-integrity issue (deep dive #4 above) — a unit-test-invisible class of bug that only exists in a database that's evolved across multiple versions of the code that writes to it. Found only because of a standing discipline in this project: after every phase, actually re-run the real pipeline against real, previously-used data and read the database directly, not just trust a green test suite.

**Q: What would you build next, and why haven't you already?**
A: RAG-based evidence retrieval for the Review page (see below) — deliberately sequenced *last*, after the deterministic core was complete and correct, because it's additive to a working system rather than a dependency of one. Building the probabilistic, harder-to-test layer on top of a solid deterministic foundation is a safer order than the reverse.

---

## Future work

### RAG — retrieval-augmented evidence for Review (next up, not started)

The last stage in the canonical pipeline (`Recommend`, between `Validate` and `Review`) and the last one not yet built. Scoped, not yet implemented — full architecture in the project's planning notes and `Project_Docs/Learnings/00_HOW_IT_WORKS.md`'s RAG roadmap section:

- Chunk each document's OCR'd text, embed with OpenAI `text-embedding-3-small`, store in `pgvector` (already available on the Supabase project, not yet enabled).
- For every field a reviewer sees flagged (`Not extracted`, or a validation `fail`/`warning`), retrieve the most semantically relevant chunk(s) of the *actual source contract* and surface them right on the Review page — so a reviewer resolving a flagged field doesn't have to go find the original PDF and search it by hand.
- Deliberately **retrieval only** for the first slice — no second LLM call proposing a value yet. Cheaper, lower-risk (purely additive to a working system), and still a real improvement to the part of the product reviewers spend the most time in. A generation-based "here's the likely value, and why" pass is a natural second slice once retrieval is proven.
- **Build methodology, decided before any code is written**: ship the instrumented baseline first — every layer (chunking, embedding, retrieval) logs its own cost, latency, and accuracy/recall metrics — evaluate repeatedly against a fixed set of real documents so before/after comparisons are meaningful, iterate on what the numbers actually show, and write the methodology and results up properly rather than just shipping and moving on. Same evidence-over-assertion discipline this README's own coverage numbers are held to, applied to the next thing being built instead of just the last thing that shipped.
- New, dedicated `apps/api/app/rag/` package (sibling to `app/pipeline/`, not folded into it) split by layer — chunking, embedding, storage, retrieval, and the feature-level orchestration — so any one layer can be tested, replaced, or reused independently and every step is individually observable, not just the pipeline as a whole.

### Other known, deliberately-deferred gaps

- **Real multi-entity/group support** — see [Regulatory coverage](#regulatory-coverage--the-real-numbers) above. Waiting on real customer signal, not a roadmap slide.
- **EU-only LLM inference** — extraction and (future) embedding calls currently go to OpenAI's standard API, not a guaranteed-EU-only endpoint. A real gap against this project's own EU-data-residency principle; not introduced by any single phase, worth its own resolution pass (Azure OpenAI EU deployment, or OpenAI's enterprise data-residency options).
- **Taxonomy-conformant XBRL-CSV** — the current export is a structured draft aid, not a filing-ready package validated against the real EBA/ESMA DPM taxonomy. Genuine conformance needs a licensed taxonomy artefact and an XBRL processor (e.g. Arelle) — deliberately out of scope for an MVP; the disclaimer manifest included in every export says so explicitly.
- **Environment separation (partial)** — local dev now runs its own Supabase stack (Docker), fully isolated. Staging and production still share one backend process and one Supabase project — splitting that pair needs a second backend deployment, deferred until real paid usage justifies it. See [Deployment](#deployment).

---

## Repository layout

```
EvidenceOS/
├── apps/
│   ├── web/         # Next.js 16 frontend (App Router + TS + Tailwind v4)
│   │   └── content/blog/  # MDX source for the public blog (apps/web/src/app/(blog)/)
│   └── api/          # FastAPI backend (Python 3.13); deploy.sh redeploys it to EC2
├── workers/         # Reserved for future standalone workers — empty; MVP
│                       background jobs run in-process (FastAPI BackgroundTasks)
├── packages/
│   ├── contracts/   # Reserved for shared Pydantic + Zod schemas — empty for now
│   └── infrastructure/  # Reserved for shared DB/storage/auth clients — empty for now
├── Project_Docs/
│   ├── (PRD, SDD, schema, roadmap, ...)
│   └── Learnings/   # Phase-by-phase build log — read this to understand the code
└── supabase/        # Migrations, config.toml, seed.sql (local-dev-only
                        # base grants — see Phase_7_Deployment/CHALLENGES.md C10)
```

**Why this layout?** See [`Project_Docs/Learnings/01_MONOREPO_LAYOUT.md`](./Project_Docs/Learnings/01_MONOREPO_LAYOUT.md).

---

## Quick start (local dev)

**Prerequisites:** Node.js 20+, Python 3.13, Docker Desktop. No cloud Supabase project needed — local dev runs its own Supabase stack (Postgres, Auth, Storage, PostgREST) entirely in Docker, fully isolated from staging/production.

```bash
# 1. Clone and copy env templates — the defaults already point at the
#    local Supabase stack started in step 2, so this works out of the box
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# 2. Local database (once per reboot; stays up until `supabase stop`)
npx supabase init    # only first time — creates supabase/config.toml
npx supabase start   # pulls Docker images (~5 min first run), then applies
                      # supabase/migrations/*.sql and supabase/seed.sql

# 3. Frontend
cd apps/web
npm install
npx next dev --webpack   # http://localhost:3000 — Turbopack (the default) crashes on some Windows setups

# 4. Backend (new terminal)
cd apps/api
python -m venv .venv
.venv\Scripts\activate   # Windows; source .venv/bin/activate on Mac/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8012   # http://localhost:8012
```

`OPENAI_API_KEY`, `LANGFUSE_*`, and `DOCUMENT_ENCRYPTION_KEY` in `apps/api/.env` still need real values (generate the encryption key with the one-liner in `.env.example`) — only the Supabase URL/keys are pre-filled with the local stack's fixed demo values.

**Windows-specific note**: this project has repeatedly hit a Windows TCP-stack issue where a port reports as still listening (owned by a PID that no longer exists in the process table) after stopping a server — the code that answers can be silently stale. If a restart fails to bind, or `curl` succeeds but a fix you just made doesn't seem to apply, move to a fresh port rather than debugging the stale listener; see [`Phase_6_Export/CHALLENGES.md`](./Project_Docs/Learnings/Phase_6_Export/CHALLENGES.md) C3 and [`Phase_7_Deployment/CHALLENGES.md`](./Project_Docs/Learnings/Phase_7_Deployment/CHALLENGES.md) C10.

Full setup walkthrough: [`Project_Docs/Learnings/Phase_0_Setup/`](./Project_Docs/Learnings/Phase_0_Setup/). Day-to-day operations (redeploying, checking logs, troubleshooting, the full local/staging/production breakdown): [`Project_Docs/Learnings/Phase_7_Deployment/03_operations_runbook.md`](./Project_Docs/Learnings/Phase_7_Deployment/03_operations_runbook.md).

---

## Deployment

| | Local dev | Staging (`claude`) | Production (`main`) |
|---|---|---|---|
| Frontend | `localhost:3000` | `evidenceos-web-git-claude-*.vercel.app` (automatic on push) | `evidenceos-web.vercel.app` (automatic on push/merge) |
| Backend | `localhost:8012` | `18.196.98.199.sslip.io` (AWS EC2, `eu-central-1`) | **same EC2 box as staging** — manual redeploy, `apps/api/deploy.sh` |
| Database | **own local Supabase stack** (Docker) — fully isolated | same cloud Supabase project as production | same cloud Supabase project as staging |
| Monitoring | — | UptimeRobot (frontend + backend `/health`, 5 min interval) | same monitors cover both |

Local dev is fully isolated from the other two — a bug in local testing can no longer touch real data. Staging and production still intentionally share one cloud Supabase project and one EC2 backend process; splitting that pair is a bigger lift (a second backend deployment, not just a database) and is deferred until real paid usage justifies the cost. Full setup log, a plain-language glossary of every AWS/nginx/systemd term involved, every bug hit along the way (including *why* local dev is separated but staging/production aren't yet), and a day-to-day operations runbook: [`Project_Docs/Learnings/Phase_7_Deployment/`](./Project_Docs/Learnings/Phase_7_Deployment/).

---

## Documentation for learners

Every phase of the build has a companion doc in [`Project_Docs/Learnings/`](./Project_Docs/Learnings/) explaining:

- **What** we built
- **Why** we chose this approach (with alternatives considered)
- **How** the code works, line by line where non-obvious
- **Challenges** we hit and how we solved them, root cause and fix, not just a changelog entry
- **Interview Q&A** on the concepts

This is the founder's reference — everything needed to explain the project to a stakeholder or interviewer, in the depth an interviewer would actually probe for.

---

## Non-goals

- Not a general GRC platform.
- Not an autonomous filer — a named human on the customer's team makes the final filing decision, always.
- Not a taxonomy-conformant XBRL-CSV filing tool (yet) — the export is a structured draft aid; see [Future work](#future-work).
- No incident reporting, no continuous monitoring (later phase).
- No NIS2 / ISO 27001 / SOC 2 workflows (later phase).

See PRD section 8 for the full non-goals list.

---

## Licence

MIT — see [`LICENSE`](./LICENSE).
