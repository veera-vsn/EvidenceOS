# Phase 0 — Overview

**Goal of Phase 0:** Get a runnable frontend + backend + shared documentation skeleton in place, so every future phase has a landing pad.

**What we built:**

1. Monorepo folders per the SDD (`apps/`, `workers/`, `packages/`, `Learnings/`, `supabase/`).
2. Next.js 16 web app in `apps/web/` — TypeScript strict, Tailwind v4, Server Components.
3. FastAPI backend in `apps/api/` — Python 3.13, Pydantic v2, structlog.
4. A working end-to-end health check: the frontend's landing page server-renders a "system status" pill by calling the backend's `/health` endpoint.
5. Environment templates, gitignore, README, tests, ruff config.

**What we did NOT build in Phase 0 (deliberately deferred):**

- Auth (Phase 0.5 — needs a real Supabase project).
- Any DB tables or migrations (Phase 1).
- shadcn/ui components (Phase 0.5 — we'll add them when we need the first form).
- Docker / production deploy config (Phase 6).

**Acceptance criteria (met):**

- [x] `apps/web` boots on port 3000 via `npm run dev`.
- [x] `apps/api` boots on port 8000 via `uvicorn app.main:app --reload`.
- [x] `GET http://localhost:8000/health` returns `{"status":"ok",...}`.
- [x] `GET http://localhost:3000/` renders "API reachable (local)".
- [x] `pytest` passes.
- [x] `npx tsc --noEmit` passes.

---

## Documents in this folder

- `01_overview.md` — this file.
- `02_frontend_scaffold.md` — every file inside `apps/web/` explained.
- `03_backend_scaffold.md` — every file inside `apps/api/` explained.
- `CHALLENGES.md` — problems hit and how solved.

Read them in order.

---

## How to run everything locally (one page)

```bash
# Terminal 1 — backend
cd apps/api
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt
copy .env.example .env             # Windows (`cp` on Unix)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — frontend
cd apps/web
npm install
copy .env.example .env.local
npm run dev
```

Open http://localhost:3000 — you should see the landing page with a green status pill.
