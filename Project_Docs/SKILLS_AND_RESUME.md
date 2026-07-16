# Skills & Resume Reference — EvidenceOS

Skills built through this project, framed for a CV, portfolio, or technical interview.
Updated continuously as phases complete.

---

## Technical Skills

### Languages

| Skill | Evidence |
|---|---|
| **Python 3.13** — type hints, dataclasses, async/sync workers | `apps/api/` — FastAPI app, pipeline worker, OCR extractor |
| **TypeScript (strict mode)** — discriminated unions, generics, no `any` | `apps/web/src/` — Next.js 16 + React 19 frontend |
| **SQL (PostgreSQL)** — schema design, RLS policies, migrations | `supabase/migrations/` — 7 migration files, RLS on all tables |

### Backend / API

| Skill | Evidence |
|---|---|
| **FastAPI** — async endpoints, BackgroundTasks, dependency injection, OpenAPI docs | `apps/api/app/` — full API with pipeline trigger endpoint |
| **Pydantic v2 + pydantic-settings** — typed config, `.env` loading, validation | `apps/api/app/core/config.py` |
| **Structlog** — structured JSON logging for production observability | Used across all Python modules |
| **RESTful API design** — 202 Accepted pattern for async jobs, discriminated response models | `apps/api/app/pipeline/router.py` |
| **Background task processing** — FastAPI `BackgroundTasks`, per-document error isolation | `apps/api/app/pipeline/ocr_worker.py` |

### AI / LLM Engineering

| Skill | Evidence |
|---|---|
| **OpenAI API (GPT-4o-mini)** — JSON mode, system/user prompts, temperature control | `apps/api/app/pipeline/field_extractor.py` |
| **Prompt engineering** — structured extraction prompts, field hints, output envelopes | Phase 3 extraction prompt design |
| **LLM observability with Langfuse** — trace naming, token cost tracking, metadata tagging, EU region | Wired in Phase 3; `_build_langfuse_client()` drop-in pattern |
| **MLOps mindset** — baseline first, measure before optimising, experiment tracking | Phase 3 design decisions |
| **RAG pipeline design** — architecture for retrieval-augmented generation (planned Phase 4) | Architecture docs |
| **AI compliance principles** — determinism gate, human-in-the-loop, LLM suggests/humans decide | CLAUDE.md §7, domain model |

### Document Processing / OCR

| Skill | Evidence |
|---|---|
| **PyMuPDF (fitz)** — PDF text extraction without external binaries | `apps/api/app/pipeline/extractor.py` |
| **python-docx** — DOCX paragraph extraction | `apps/api/app/pipeline/extractor.py` |
| **openpyxl** — XLSX cell reading, read-only + data-only modes | `apps/api/app/pipeline/extractor.py` |
| **Multi-format dispatch pattern** — handler dict keyed by MIME/extension | `_HANDLERS` in `extractor.py` |

### Frontend / Full-Stack

| Skill | Evidence |
|---|---|
| **Next.js 16** — App Router, Server Actions, Server Components | `apps/web/src/app/` |
| **React 19** — hooks, composition, typed props | Throughout `apps/web/` |
| **Tailwind CSS v4** — utility-first styling | All page components |
| **Supabase JS client** — Auth, Storage, typed PostgREST queries | Upload flow, auth pages |
| **Two-step upload protocol** — Server Action creates DB row → browser uploads to Storage → confirm | `apps/web/src/app/.../actions.ts` |
| **Environment variable safety (Turbopack)** — static literal access for `NEXT_PUBLIC_*` | `apps/web/src/lib/env.ts` — Resolution 004 |

### Database / Infrastructure

| Skill | Evidence |
|---|---|
| **Supabase** — Postgres, Auth (email/password), Storage (private buckets), RLS | Full stack — auth, upload, pipeline |
| **Row Level Security (RLS)** — policy design, service-role bypass pattern for workers | `supabase/migrations/` |
| **Database schema design** — normalised tables, foreign key constraints, upsert idempotency | `0001–0007` migrations |
| **Idempotent upserts** — `ON CONFLICT DO UPDATE` via unique constraints | `extraction_results`, `document_text` |

### DevOps / Tooling

| Skill | Evidence |
|---|---|
| **Monorepo structure** — `apps/web`, `apps/api`, `supabase/`, `packages/` separation | Repo root |
| **pnpm workspaces** — frontend package management | `pnpm-workspace.yaml` |
| **Ruff** — Python linter + formatter (replaces black + isort + flake8) | `apps/api/pyproject.toml` |
| **Git branching** — feature branch (`claude`) → PR to `main` | Project workflow |
| **Virtual environments** — Python `.venv` isolation | `apps/api/.venv/` |

---

## Domain Knowledge

### EU Regulatory / DORA

| Knowledge Area | Evidence |
|---|---|
| **DORA Regulation (EU 2022/2554)** — Article 28(3) Register of Information requirements | Core product rationale |
| **EBA DPM 4.0 taxonomy** — RT.02.01/RT.02.02/RT.05.01/RT.06.01 reporting templates; real 116-check regulatory bar (2024 ESAs Dry Run) | `field_extractor.py` DORA_FIELDS catalogue |
| **xBRL-CSV export format** — the submission format required by NCAs | Target output (Phase 6+) |
| **GDPR / EU data residency** — why all persistent data must stay in EU regions | Architecture decisions throughout |
| **ICT third-party risk** — what the DORA RoI is measuring; vendor concentrations; criticality assessment | Domain model, PRD |

### Fintech / SaaS

| Knowledge Area | Evidence |
|---|---|
| **Compliance SaaS positioning** — why mid-sized EU financial entities are the right wedge | PRD, target market doc |
| **Human-in-the-loop product design** — AI drafts, humans approve, deterministic rules decide compliance | CLAUDE.md §7 |
| **B2B SaaS architecture** — workspace/tenant isolation, role-based access, audit logs | Schema design, RLS policies |

---

## Architecture Patterns

| Pattern | Where used | Why |
|---|---|---|
| **Layered pipeline** | Upload → OCR → Extract → Validate → Export | Each stage independently testable, re-runnable |
| **Background worker + 202 Accepted** | `/pipeline/runs/{id}/trigger` | Never block HTTP response on slow I/O |
| **Service-role client bypass** | `ocr_worker.py` | Worker is trusted internal process; no user JWT needed |
| **Drop-in instrumentation** | `from langfuse.openai import OpenAI` | Zero-friction LLM observability without touching call sites |
| **Baseline before optimise** | Langfuse wired in Phase 3 | Measure cost/accuracy before changing prompts or models |
| **Config as single source of truth** | `pydantic-settings` → `os.environ` | No `os.environ` scattered in application code |
| **Idempotent upserts** | `extraction_results`, `document_text` | Re-running a pipeline overwrites, not duplicates |
| **Static env var access (Turbopack)** | `process.env.NEXT_PUBLIC_FOO` | Dynamic bracket access is invisible to Next.js bundler |

---

## CV / Interview Talking Points

### "Tell me about a full-stack project you built."

*EvidenceOS is an AI copilot for EU financial entities to automate their DORA Register of Information — the regulatory submission that 93.5% of firms failed in the March 2026 EU-wide dry run. I built the full stack: a Next.js 16 frontend, a FastAPI Python backend, document OCR using PyMuPDF and python-docx, GPT-4o-mini field extraction against the ESMA ITS taxonomy, and LLM observability via Langfuse (EU region for GDPR). The pipeline is async — a 202 Accepted trigger endpoint kicks off a background worker that processes documents independently so the UI stays responsive.*

### "How do you think about cost control for LLM APIs?"

*Baseline first. Before touching a prompt, you need to know what you're paying per document and what accuracy you're getting. I wired Langfuse into every OpenAI call on day one — token counts, latency, cost per trace — so the Langfuse dashboard gives me the cost curve for free. Then I can make model or prompt changes as experiments and compare cost vs. accuracy deltas against the baseline. Optimising blind is how teams end up over-spending on GPT-4o for tasks GPT-4o-mini handles equally well.*

### "Why EU region for everything?"

*DORA is an EU regulation. The documents being processed are ICT vendor contracts — they may contain personal data of contract signatories and are commercially sensitive. Under GDPR Article 44, personal data can't leave the EEA without appropriate safeguards. Designing for EU regions from day one is cheaper than retrofitting it: once data has flowed to a US region, you have a compliance event to clean up. Langfuse EU, Supabase Frankfurt, OpenAI EU data processing addendum — all locked in from Phase 0.*

### "How do you handle errors in a multi-stage pipeline?"

*Per-document error isolation. In `ocr_worker.py`, each document's OCR and field extraction stages are independently try/caught. If OCR fails for one document, that document is marked `ocr_status='failed'` and skipped, but the other documents continue. The run is only marked `'failed'` (not `'completed'`) if every document fails. This prevents a single corrupt file from silently blocking an entire batch.*

---

## Tools to add to LinkedIn / CV

- Python, FastAPI, Pydantic v2, Structlog
- TypeScript, Next.js, React, Tailwind CSS
- OpenAI API (GPT-4o-mini), Prompt Engineering
- Langfuse (LLM Observability)
- Supabase (PostgreSQL, Auth, Storage, RLS)
- PyMuPDF, python-docx, openpyxl
- Ruff, pytest
- DORA Regulation (EU 2022/2554), ESMA ITS taxonomy
- EU data residency / GDPR compliance architecture
