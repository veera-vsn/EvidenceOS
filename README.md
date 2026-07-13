# EvidenceOS

**AI-powered DORA Register of Information (RoI) evidence & validation copilot for EU financial entities.**

EvidenceOS turns fragmented contracts, spreadsheets, and vendor inventories into a submission-ready DORA RoI draft — with evidence, validation, and explainable AI recommendations that always remain under human control.

> This is the MVP implementation. For full product context read [`Project_Docs/`](./Project_Docs/) — especially the PRD and SDD.

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
|   |-- web/         # Next.js 14 frontend (App Router + TS + Tailwind + shadcn/ui)
|   \-- api/         # FastAPI backend (Python 3.13)
|-- workers/         # Async pipeline workers (OCR, extraction, validation, ...)
|-- packages/
|   |-- contracts/   # Shared Pydantic + Zod schemas
|   \-- infrastructure/  # Shared DB / storage / auth clients
|-- scripts/         # Dev + deployment scripts
|-- Project_Docs/
|   |-- (PRD, SDD, schema, roadmap, ...)
|   \-- Learnings/   # Step-by-step build documentation — read this to understand the code
\-- supabase/        # Supabase migrations + config (added Phase 0)
```

**Why this layout?** See [`Project_Docs/Learnings/01_MONOREPO_LAYOUT.md`](./Project_Docs/Learnings/01_MONOREPO_LAYOUT.md).

---

## Tech stack (one-liner)

Next.js + FastAPI + Supabase Postgres (EU) + Azure Document Intelligence + Claude/GPT + LangGraph.

**Why each choice?** See [`Project_Docs/Learnings/00_STACK_DECISIONS.md`](./Project_Docs/Learnings/00_STACK_DECISIONS.md).

---

## Quick start (local dev)

**Prerequisites:** Node.js 20+, Python 3.11+, a Supabase project (EU region).

```bash
# 1. Clone and copy env templates
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# 2. Frontend
cd apps/web
npm install
npm run dev            # http://localhost:3000

# 3. Backend (new terminal)
cd apps/api
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000
```

Full setup walkthrough: [`Project_Docs/Learnings/Phase_0_Setup/`](./Project_Docs/Learnings/Phase_0_Setup/).

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
