# EvidenceOS

**AI-powered DORA Register of Information (RoI) evidence & validation copilot for EU financial entities.**

EvidenceOS turns fragmented contracts, spreadsheets, and vendor inventories into a submission-ready DORA RoI draft — with evidence, validation, and explainable AI recommendations that always remain under human control.

> This is the MVP implementation. For full product context read [`Project_Docs/`](./Project_Docs/) — especially the PRD and SDD.

---

## Status

The full pipeline below is built and working end-to-end, with a redesigned
UI, and deployed to a live staging environment plus a production
environment (`main`, currently sharing the same backend/database as
staging — see [deployment status](#deployment) below).

| Phase | What | Status |
|---|---|---|
| 0 – 0.5 | Scaffold, auth, Supabase schema + RLS | ✅ |
| 1 | Document upload + storage | ✅ |
| 2 | OCR worker | ✅ |
| 3 | DORA field extraction (LLM) + Langfuse observability | ✅ |
| 4 | Deterministic validation | ✅ |
| 5 | Human review workflow | ✅ |
| 6 | xBRL-CSV export (draft) | ✅ |
| — | UI/UX redesign (all pages) | ✅ |
| 7 | Deployment — AWS EC2 (API) + Vercel (web) | ✅ (staging + production live) |
| — | RAG / evidence retrieval | not started |

Full detail on every phase: [`Project_Docs/Learnings/`](./Project_Docs/Learnings/).

---

## Pipeline

```
Upload -> Extract -> Normalize -> Validate -> Recommend -> Review -> Export
```

Every AI output carries **evidence + confidence + reason**. Every export is **traceable to source**. Nothing auto-finalises.

---

## Repository layout

```
EvidenceOS/
|-- apps/
|   |-- web/         # Next.js 16 frontend (App Router + TS + Tailwind v4)
|   \-- api/         # FastAPI backend (Python 3.13), deploy.sh redeploys it to EC2
|-- workers/         # Reserved for future standalone workers — empty for now;
|                       MVP background jobs run in-process (FastAPI BackgroundTasks)
|-- packages/
|   |-- contracts/   # Reserved for shared Pydantic + Zod schemas — empty for now
|   \-- infrastructure/  # Reserved for shared DB / storage / auth clients — empty for now
|-- Project_Docs/
|   |-- (PRD, SDD, schema, roadmap, ...)
|   \-- Learnings/   # Step-by-step build documentation — read this to understand the code
\-- supabase/        # Supabase migrations + config (added Phase 0)
```

**Why this layout?** See [`Project_Docs/Learnings/01_MONOREPO_LAYOUT.md`](./Project_Docs/Learnings/01_MONOREPO_LAYOUT.md).

---

## Tech stack (one-liner)

Next.js 16 + FastAPI (Python 3.13) + Supabase Postgres (EU) + Claude/GPT + Langfuse. Deployed on Vercel (web) + AWS EC2 (API).

**Why each choice?** See [`Project_Docs/Learnings/00_STACK_DECISIONS.md`](./Project_Docs/Learnings/00_STACK_DECISIONS.md) (the AWS EC2 backend choice specifically postdates that doc — see [Deployment](#deployment) below for why).

---

## Deployment

| | URL | Deploys on |
|---|---|---|
| Staging frontend | `evidenceos-web-git-claude-*.vercel.app` | every push to `claude` (automatic) |
| Production frontend | `evidenceos-web.vercel.app` | every push/merge to `main` (automatic) |
| Backend (shared by both, for now) | AWS EC2, `eu-central-1` | manual — `apps/api/deploy.sh` |

Staging and production currently share one backend process and one
Supabase project — there's no environment data separation yet. Full
setup log, a plain-language glossary of every AWS/nginx/systemd term
involved, every bug hit along the way, and a day-to-day operations
runbook: [`Project_Docs/Learnings/Phase_7_Deployment/`](./Project_Docs/Learnings/Phase_7_Deployment/).

---

## Quick start (local dev)

**Prerequisites:** Node.js 20+, Python 3.13, a Supabase project (EU region).

```bash
# 1. Clone and copy env templates
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# 2. Frontend
cd apps/web
npm install
npx next dev --webpack   # http://localhost:3000 — Turbopack (the default) crashes on some Windows setups

# 3. Backend (new terminal)
cd apps/api
python -m venv .venv
.venv\Scripts\activate  # Windows; source .venv/bin/activate on Mac/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000 (or whichever PORT is set in .env)
```

Full setup walkthrough: [`Project_Docs/Learnings/Phase_0_Setup/`](./Project_Docs/Learnings/Phase_0_Setup/). Day-to-day operations (redeploying, checking logs, troubleshooting): [`Project_Docs/Learnings/Phase_7_Deployment/03_operations_runbook.md`](./Project_Docs/Learnings/Phase_7_Deployment/03_operations_runbook.md).

---

## Documentation for learners

Every phase of the build has a companion doc in [`Project_Docs/Learnings/`](./Project_Docs/Learnings/) explaining:

- **What** we built
- **Why** we chose this approach (with alternatives considered)
- **How** the code works, line by line where non-obvious
- **Challenges** we hit and how we solved them
- **Interview Q&A** on the concepts

This is the founder's reference — everything you need to explain the project to a stakeholder or interviewer.

---

## Non-goals (in-scope for MVP, out-of-scope until later)

- Not a general GRC platform.
- Not an autonomous filer.
- No incident reporting, no continuous monitoring (that's Phase 3+).
- No NIS2 / ISO 27001 / SOC 2 workflows (Phase 4).

See PRD section 8 for the full non-goals list.

---

## Licence

MIT — see [`LICENSE`](./LICENSE).
