# 00 — Stack Decisions & Rationale

> **Purpose of this doc:** Every technology choice in EvidenceOS has a reason. This document captures **what we chose**, **what we rejected**, and **why** — so you can defend every decision in a code review, an investor meeting, or a job interview.

---

## The three constraints that drive every decision

Before we pick any tool, remember the three constraints imposed by the product:

1. **EU-only data residency.** DORA and GDPR both apply. Any service that touches customer data must be hosted in the EU (Frankfurt, Ireland, Paris). This eliminates most US-first SaaS products from consideration.
2. **Solo-founder operability.** We can't run a 10-service microservice mesh. The stack must be operable by one engineer without a DevOps team.
3. **Regulated-workflow trust.** Financial-services buyers demand: audit logs, evidence traceability, encryption at rest, RLS, SSO-ready, versioning. The stack must make these easy, not hard.

Every choice below is a compromise across those three axes.

---

## Layer-by-layer decisions

### 1. Frontend — Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui

**Chosen because:**

- **Next.js App Router** gives us Server Components — critical for auth-gated dashboards, since we can check the user's session on the server before rendering anything (no flash of unauthenticated content, no client bundle bloat).
- **TypeScript strict** — regulatory software must not fail silently. The type system catches "undefined is not a function" before the customer does.
- **Tailwind CSS** — utility classes let a solo founder ship consistent UI without writing a design system from scratch. We keep our own tokens in `tailwind.config.ts`.
- **shadcn/ui** — this is *not* a component library; it's a set of copy-pasted, accessible primitives built on Radix. Two big wins:
  1. **No vendor lock-in** — the code lives in our repo, we own it.
  2. **Accessibility for free** — Radix ships correct ARIA / keyboard behaviour, which regulated buyers audit.

**Alternatives considered and why we rejected them:**

| Alternative | Why rejected |
|---|---|
| Vite + React SPA | No server-side rendering, harder to protect routes, worse SEO for marketing pages, no built-in route-level code splitting |
| Remix | Similar model to Next but smaller ecosystem, fewer shadcn/Vercel integrations |
| SvelteKit | Smaller talent pool — harder to hire a second engineer later |
| Angular | Overkill; regulated features don't need Angular's opinions |
| Material UI / Chakra | Heavier, harder to customise, styling escape-hatches feel bolted on. shadcn wins on ownership |

**Interview Q:** *"Why not a Next.js API route instead of a separate FastAPI backend?"*
**A:** Next.js API routes run in a Node runtime that isn't great for Python-based OCR/ML workloads. We already need Python for the AI pipeline (LangGraph, OCR SDKs, evidence embeddings) — putting API logic in Python too keeps one language across backend + workers, and lets us share Pydantic models between HTTP handlers and Celery workers.

---

### 2. Backend — FastAPI (Python 3.13)

**Chosen because:**

- **Same language as the AI pipeline.** OCR SDKs (Azure Document Intelligence, LlamaParse), LLM orchestration (LangGraph), embeddings (sentence-transformers) — the mature libraries here are all Python. Splitting the backend into TypeScript would force us to either duplicate models or send data over the wire between languages.
- **Pydantic v2** — schemas defined once become HTTP validators, DB serialisers, and OpenAPI docs. This is invaluable for a regulated product because the schema is the contract, and the contract is auditable.
- **Async-native.** Long-running LLM calls and OCR jobs must not block the request thread. FastAPI's `async def` handlers + BackgroundTasks make this idiomatic without dragging in Celery for MVP.
- **Automatic OpenAPI docs at `/docs`** — reviewers and pentesters can inspect the API surface without extra tooling.

**Alternatives considered:**

| Alternative | Why rejected |
|---|---|
| Django | Heavier, opinionated ORM (we want SQL-first with SQLAlchemy Core), overkill for API-only |
| Flask | Sync-first, no built-in validation, no OpenAPI. FastAPI is Flask's spiritual successor |
| Node.js (Express/NestJS) | Cannot use Python-native OCR/ML libraries in-process; forces polyglot pain |
| Go | Great performance but small AI-library ecosystem; no reason to accept the trade-off for MVP |
| Ruby on Rails | Same language-split problem as Node |

**Interview Q:** *"Why not Django REST Framework?"*
**A:** Django's opinions (ORM, admin, sessions) don't fit our architecture. We store our source of truth in Supabase Postgres with RLS — Django's session-based auth would conflict. FastAPI stays out of the way and lets Supabase own auth.

---

### 3. Database — Supabase (managed Postgres, EU region)

This is arguably our most important decision. Let's unpack it.

**Chosen because:**

- **Postgres is the right database for our data model.** Our schema has strong relational integrity (foreign keys everywhere), needs versioning (append-only history), full-text search (evidence retrieval), JSONB (semi-structured extraction payloads), and — later — pgvector for embeddings. Postgres handles all five without adding another data store.
- **Supabase specifically** bundles Postgres + Auth + Storage + Realtime + row-level security in one managed EU-hosted service. For a solo founder, this collapses five vendor relationships into one.
- **Row-Level Security (RLS)** is the security model. RLS lets us enforce "user X can only see rows belonging to org X" *at the database level*, so even if the API has a bug, the leak is contained. This is non-negotiable for multi-tenant regulated software.
- **EU region (Frankfurt)** satisfies DORA data-residency.

**Alternatives considered:**

| Alternative | Why rejected |
|---|---|
| MongoDB | Weak relational integrity, weak JOIN performance, harder to audit. Our data is deeply relational (documents -> versions -> extractions -> validations -> reviews -> exports) |
| Neo4j | The SDD explicitly rules this out for MVP. Postgres CTEs handle our evidence-graph traversals fine at MVP volumes |
| Firebase Firestore | US-hosted default, hard to enforce EU residency, weaker SQL, weaker schema evolution |
| PlanetScale (MySQL) | No JSONB, no native full-text on complex queries, US-first |
| Self-hosted Postgres on Hetzner | Sure, cheaper per byte — but I'd spend a week per month on backups, monitoring, failover, patching. Supabase's premium is DevOps insurance |
| AWS RDS + Cognito + S3 | Same capability, but three vendors, three billing systems, three IAM policies to reason about. Not solo-founder-friendly |

**Interview Q:** *"Aren't you locked into Supabase?"*
**A:** Partially — but Postgres itself is portable. Migrations are plain SQL. Supabase Storage is S3-compatible. Supabase Auth is JWT-based, which every stack understands. If we ever grow past Supabase's ceiling, exiting is a migration project, not a rewrite.

**Interview Q:** *"Why not use an ORM like Prisma or SQLAlchemy full-fat?"*
**A:** We use SQLAlchemy Core (SQL builder) but not the ORM. Reason: regulatory schemas evolve slowly and are audited by hand — we want migrations to be plain SQL files reviewers can read, not ORM-inferred diffs. See `Learnings/Phase_0_Setup/03_backend_scaffold.md` for how we set this up.

---

### 4. Object Storage — Supabase Storage

**Chosen because:**

- Bundled with Supabase (one vendor).
- S3-compatible protocol under the hood — portable.
- Native signed-URL API for time-limited document access.
- Encryption at rest by default.
- EU-hosted.

**Alternatives:** AWS S3 direct (more work to integrate auth), Cloudflare R2 (fine but adds a vendor), MinIO self-hosted (more DevOps).

---

### 5. Queue / Async processing — start with Postgres, upgrade to Celery+Redis later

**MVP approach:** Postgres-based job table + FastAPI `BackgroundTasks` for MVP. No Redis, no Celery.

**Why not Celery+Redis on day one?**
- Adds two moving parts (Redis, Celery beat/worker) that must be deployed, monitored, backed up.
- Our expected pilot volume is ~100 documents/day, ~10 pipeline runs/day — Postgres handles this trivially.
- We already have Postgres — adding a `jobs` table gives us at-least-once semantics with retry counts and status, which is 80% of what Celery gives us.

**When we'll upgrade:** if any of these become true:
- Job throughput exceeds Postgres's practical polling limits (~50 jobs/sec).
- We need scheduled recurring jobs (Celery beat).
- Workers need to run on separate machines from the API.

Documented as a future decision in `Learnings/Phase_0_Setup/04_queue_choice.md` (we'll write this when Phase 2 arrives).

---

### 6. OCR — Azure Document Intelligence (with LlamaParse fallback)

**Chosen because:**
- **EU regions available** (West Europe, North Europe).
- **Preserves layout, tables, and reading order** — critical for extracting clauses from contracts where position matters.
- **Contract-specific pretrained models** (Layout, General Document, Custom).
- Better price-per-page than Google Document AI for our volume.

**Alternatives considered:**
- **AWS Textract** — good but EU support inconsistent; harder to guarantee residency.
- **Google Document AI** — great accuracy, but data-residency configuration is fiddly and more expensive at pilot volumes.
- **Open-source (Tesseract, EasyOCR)** — accuracy on complex legal contracts is not viable for regulated output. Useful as a dev-mode fallback only.
- **LlamaParse (LlamaIndex)** — used as fallback for unusually complex layouts where Azure fails.

---

### 7. LLM — Claude Sonnet 4.6 for reasoning, Haiku 4.5 for extraction, embeddings via OpenAI/Cohere

**Split model strategy:**
- **Claude Sonnet 4.6** — recommendation reasoning, clause interpretation, natural-language explanations. Best trade-off of quality vs. cost for reasoning-heavy tasks.
- **Claude Haiku 4.5** — high-volume structured extraction (vendor names, dates, clause detection). Cheaper, faster, still very strong.
- **Embeddings** — Cohere `embed-multilingual-v3` (EU inference option) or OpenAI `text-embedding-3-small`. Multilingual matters because EU contracts arrive in DE/FR/IT.

**Interview Q:** *"Why not one model for everything?"*
**A:** Cost. Extraction is a high-volume, low-reasoning task — using Sonnet for every field would burn budget on tasks Haiku handles just as well. Splitting saves 5-10x on the extraction pipeline.

**Interview Q:** *"What about the EU AI Act?"*
**A:** Our LLM usage falls under "AI system used as safety component / decision-support in a regulated domain," which will likely require a risk assessment under the AI Act. Our confidence bands + human-in-the-loop review satisfy the "meaningful human oversight" requirement in the current draft. Phase 4 of the roadmap includes explicit AI Act compliance workflow.

---

### 8. Deployment — Vercel (frontend) + Fly.io/Railway EU (backend)

**Chosen because:**
- **Vercel** — first-class Next.js hosting, EU edge regions, preview URLs per PR, one-click env-var management.
- **Fly.io (or Railway) in EU region** — container-native, cheap, EU-hosted, faster deploys than AWS ECS for a solo team.

**Alternatives:**
- **AWS ECS/EKS** — too much YAML for MVP.
- **Google Cloud Run** — good option; Fly wins on price at our scale.
- **Self-hosted on Hetzner** — cheapest, but ops burden defeats the purpose.

---

## The meta-decision: modular monolith, not microservices

The SDD is explicit about this. Let me re-explain the reasoning in plain English:

**A microservice architecture has hidden costs:**
- Cross-service transactions become distributed transactions (Sagas, outbox patterns).
- Schema changes require coordinated deploys.
- Local development requires running 5 services just to test one flow.
- Observability requires distributed tracing infrastructure from day one.

**A modular monolith gives us:**
- **Fast iteration** — one repo, one deploy target, one process to attach a debugger to.
- **Cheap refactoring** — changing a module boundary is a rename, not a service migration.
- **Clean escape hatch** — because we enforce module boundaries in code (see `packages/`), we can extract any module into its own service later without rewriting.

**Interview Q:** *"When would you split into microservices?"*
**A:** When a specific module has independent scaling needs (e.g., OCR bursts to 100 documents/minute but the API stays flat), or when a team is large enough that coordinating a monolith deploy is more expensive than running microservices. Neither is true at pre-seed.

---

## Summary table

| Concern | Choice | Killer feature |
|---|---|---|
| Frontend | Next.js 14 App Router | Server Components + Vercel EU |
| Language (backend) | Python 3.13 | Shared with AI pipeline |
| API framework | FastAPI | Pydantic-first, async-native, OpenAPI |
| Database | Supabase Postgres (EU) | RLS + Auth + Storage bundled |
| ORM | SQLAlchemy Core (not full ORM) | SQL-first migrations, auditable |
| Object storage | Supabase Storage | S3-compatible, EU |
| Async jobs (MVP) | Postgres job table | Zero new infrastructure |
| Async jobs (later) | Celery + Redis EU | When volume demands |
| OCR | Azure Document Intelligence | EU region + layout + table extraction |
| LLM | Claude Sonnet + Haiku (split) | Best quality/cost trade-off |
| Embeddings | Cohere / OpenAI | Multilingual EU inference |
| Deploy (FE) | Vercel EU | Native Next.js |
| Deploy (BE) | Fly.io EU | Cheap, container-native |
| Style | Modular monolith | Fast iteration, escape hatch preserved |

---

## What to read next

1. `01_MONOREPO_LAYOUT.md` — how the folder structure enforces the module boundaries described above.
2. `Phase_0_Setup/02_frontend_scaffold.md` — every config file in `apps/web` explained.
3. `Phase_0_Setup/03_backend_scaffold.md` — every config file in `apps/api` explained.
