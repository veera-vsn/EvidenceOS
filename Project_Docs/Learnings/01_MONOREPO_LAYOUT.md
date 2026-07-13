# 01 — Monorepo Layout Explained

> **Purpose:** Every folder in this repo has a reason to exist. This doc walks through each one, explains what lives there, why it's separate from its neighbours, and when you'd add new folders.

---

## Top-level tree

```
EvidenceOS/
|-- apps/
|   |-- web/               # Next.js 14 frontend
|   \-- api/               # FastAPI backend
|-- workers/               # Async pipeline workers (Phase 2+)
|-- packages/
|   |-- contracts/         # Shared data schemas (Pydantic + generated Zod)
|   \-- infrastructure/    # Shared clients (DB, storage, auth)
|-- scripts/               # Dev + deployment scripts
|-- supabase/              # DB migrations + config (Phase 0+)
|-- Project_Docs/
|   |-- (PRD, SDD, schema, roadmap)
|   \-- Learnings/         # This documentation — read to understand the code
|-- .env.example           # Template for shared environment variables
|-- .gitignore
|-- LICENSE
\-- README.md
```

---

## Why a monorepo?

Three code artefacts must stay in lockstep: frontend types, backend schemas, and DB migrations. A monorepo lets us:

1. **Bump the schema and update both apps in one PR** — no cross-repo dance.
2. **Share code via `packages/`** — one Pydantic model becomes the API request body *and* a generated Zod schema on the frontend.
3. **Run one command to spin up the whole system locally** (`npm run dev` at root will orchestrate both apps once we wire it in Phase 6).

The tradeoff is that a monorepo needs discipline — module boundaries must be enforced by convention, not just by process boundaries. That's why we use `packages/` (below).

---

## `apps/` — deployable applications

Anything in `apps/` is a **runnable, deployable unit** with its own package manifest and start command.

### `apps/web/` — Next.js 14 frontend

- **What lives here:** all React components, pages, client-side state, styles.
- **Runtime:** Node.js (dev) / Vercel Edge (prod).
- **Owns:** the browser experience — auth UI, document upload, review queues, export centre.
- **Does NOT own:** business logic. All decisions (validation, extraction, recommendations) happen in `apps/api` and workers. The frontend is a "smart display" over structured API responses.

### `apps/api/` — FastAPI backend

- **What lives here:** HTTP handlers, request/response schemas, business orchestration, DB access, auth verification.
- **Runtime:** Python 3.13 / Uvicorn / Fly.io in prod.
- **Owns:** the source of truth for all business rules. If a rule is worth enforcing, it's enforced here (and mirrored in the DB via constraints + RLS).
- **Does NOT own:** the OCR + extraction + validation *compute*. Those are handed off to `workers/` (Phase 2+). The API triggers jobs and reads results.

---

## `workers/` — asynchronous pipeline stages

Phase 2 and later. Each stage of the DORA pipeline becomes a worker process:

```
workers/
|-- ocr/               # Runs OCR on uploaded documents
|-- extraction/        # LLM extraction of vendors, contracts, clauses
|-- normalization/     # Duplicate vendor detection + canonicalisation
|-- validation/        # Deterministic rule engine
|-- recommendation/    # LLM recommendation generation
\-- export/            # RoI draft package assembly
```

**Why separate from `apps/api`?** Long-running compute (30s OCR, 60s LLM call) must not block the HTTP request loop. Workers pull jobs from the queue, run to completion, and write results back to Postgres. The API only checks status.

**Why one folder per worker, not one big worker?** Boundaries. If OCR is slow, we scale only the OCR worker. If a bug affects extraction, we deploy only the extraction worker. Each folder is a candidate future microservice.

---

## `packages/` — shared code

This is where module boundaries are enforced.

### `packages/contracts/`

- **What lives here:** Pydantic models (Python) that define the shape of every domain object — Document, Vendor, Contract, Validation, Recommendation, etc.
- **Generated artefacts:** Zod schemas (TypeScript) auto-generated from the Pydantic models via `scripts/generate-contracts.ts`. This gives us type-safe API calls from the frontend without hand-writing types twice.
- **Why:** the schema is the contract between frontend and backend. Any breaking change breaks the build — you can't accidentally ship a mismatch.

### `packages/infrastructure/`

- **What lives here:** shared client factories — Supabase client, storage client, LLM client, OCR client.
- **Why:** both `apps/api` and `workers/` need to talk to Supabase Storage. Without a shared package, we'd copy the client setup twice and drift.

**When to add a new package:** if a piece of logic is used in 2+ apps or workers AND doesn't belong in the domain layer.

**When NOT to:** don't split code just because "modularity is good." Premature packaging creates its own coupling.

---

## `scripts/` — dev and deployment scripts

- `scripts/dev.sh` — spins up frontend + backend + Supabase local emulator side-by-side.
- `scripts/generate-contracts.ts` — regenerates Zod schemas from Pydantic.
- `scripts/seed.py` — seeds a local Supabase with demo data for testing.

Nothing here runs in production. Everything is short-lived tooling.

---

## `supabase/` — database migrations and config

Populated in Phase 0. Structure:

```
supabase/
|-- migrations/
|   |-- 20260712_0001_initial_schema.sql
|   \-- 20260713_0001_add_documents_table.sql
|-- seed.sql             # Local dev seed data
\-- config.toml          # Supabase project config (local emulator)
```

**Rule:** every schema change is a new numbered migration. Never edit a committed migration — write a new one that alters or rolls back. This is the same discipline auditors expect from any regulated product.

---

## `Project_Docs/` — product and engineering documentation

- **Root of `Project_Docs/`** — the "north star" documents: PRD (what we're building), SDD (how the system fits together), db_schema (source of truth for the data model), api_spec, ui_spec, milestone_roadmap.
- **`Learnings/`** — the founder's / new-engineer's guide. Every implementation phase gets a subfolder that explains what was built, why, code walkthroughs, challenges, interview Q&A.

---

## Naming conventions

- **Folders:** `snake_case` for Python, `kebab-case` for TypeScript. Never `camelCase` folders — it breaks case-insensitive filesystems (Windows, macOS default).
- **Files inside `Learnings/`:** numbered prefixes (`00_`, `01_`, `Phase_0_Setup/01_`) so they sort in reading order.
- **Migration files:** `YYYYMMDD_NNNN_short_description.sql` — Supabase's convention.

---

## What we deliberately do NOT have

- **No `common/` or `utils/` folder.** These are magnets for junk. Utilities belong to the module that uses them; if two modules need one, promote to `packages/infrastructure/`.
- **No top-level `src/`.** The apps are the entry points; wrapping everything in `src/` is a Java-ism that adds a directory without adding clarity.
- **No `docs/` at the repo root.** All docs live under `Project_Docs/` where the PRD and SDD already are — one place to look.

---

## Interview Q&A

**Q:** *"Why a monorepo instead of separate repos for frontend and backend?"*
**A:** Our frontend and backend evolve together — a schema change requires a coordinated update. Separate repos would force us to publish an internal package (bumping versions in two PRs across two CI pipelines) for every change. Monorepo collapses that into one PR.

**Q:** *"How do you enforce module boundaries in a monorepo?"*
**A:** Two ways: (1) TypeScript path aliases (`@evidenceos/contracts`) which fail the build if imports leak; (2) code review — anything in `packages/` must be justified as truly shared, and anything in `apps/api` must not import from `apps/web` and vice versa.

**Q:** *"Won't the repo become huge?"*
**A:** Our code footprint is small (backend + frontend + a few workers). Node modules are gitignored. The docs and migrations are text. We won't cross 100 MB before Phase 6.

**Q:** *"Why Nx / Turborepo / Bazel?"*
**A:** Not needed at our size. Nx pays off when you have 10+ apps sharing dependencies. We have 2 apps and 2 shared packages. When we cross 5 apps we'll reconsider Turborepo for its build caching.

---

## What to read next

- `Phase_0_Setup/02_frontend_scaffold.md` — everything inside `apps/web/`.
- `Phase_0_Setup/03_backend_scaffold.md` — everything inside `apps/api/`.
