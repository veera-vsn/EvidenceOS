# CLAUDE.md — Working agreement for AI assistants on EvidenceOS

This file is auto-loaded by Claude Code (and any other agent that respects
the `CLAUDE.md` convention) when it operates inside this repo. It is the
short version of "how we work here." Every rule below has a reason.

---

## 1. What we are building

**EvidenceOS** — an AI-powered evidence and validation copilot for the
**DORA Register of Information (RoI)** required under **EU Regulation
2022/2554 Article 28(3)**.

- **Who we serve.** Mid-sized EU financial entities (50-1000 employees):
  payment institutions, e-money institutions, small/medium banks,
  fintechs, insurers, credit institutions. These firms must submit an
  xBRL-CSV RoI to their national competent authority (NCA) annually and
  keep it accurate quarterly.
- **The problem.** In the March 2026 EU-wide submission only **6.5% of
  firms passed all 116 quality checks** (ESMA/EIOPA/EBA dry-run
  data). Most firms rely on spreadsheets and consulting hours.
- **Our wedge.** Pipeline: **Upload → Extract → Normalize → Validate →
  Recommend → Review → Export**. Deterministic checks decide compliance;
  AI reasons about ambiguity; humans approve every finalisation.

Full context: `Project_Docs/Learnings/00_STACK_DECISIONS.md`,
`Project_Docs/Learnings/00.5_TARGET_MARKET_AND_POSITIONING.md`,
`Project_Docs/COMPETITORS.md`.

---

## 2. Repo shape

- Working branch is **`claude`**. Do not touch `main` without an explicit
  ask.
- This is a git repo **separate** from the outer `DORA_SAAS/` folder.
  Always operate inside `EvidenceOS/`.
- Modular monorepo:
  - `apps/web/` — Next.js 16 + React 19 + TS strict + Tailwind v4
  - `apps/api/` — FastAPI + Python 3.13 + pydantic v2 + structlog
  - `workers/` — future OCR / xBRL export jobs
  - `packages/` — shared TS types + Zod schemas (empty for now)
  - `supabase/` — SQL migrations + RLS policies (Phase 0.5)
  - `Project_Docs/` — the deliverable documentation

---

## 3. Coding standards (non-negotiable)

- **TypeScript.** `strict: true`. No `any`, no `!` non-null assertions
  outside tests. Discriminated unions for API responses.
- **Python.** Type hints on every function signature. `ruff` clean.
  `pytest` passes before commit.
- **Small functions.** Single responsibility. If a function does not fit
  on one screen, split it. Prefer pure functions where possible.
- **Docstrings.** Every public function, every class, every module.
  Explain **why** and note edge cases. WHAT the code does should be
  obvious from the code itself.
- **Comments.** Only when the WHY is not obvious. Do not narrate what
  the code does. Do not reference tasks, PRs, or authors.
- **British English** in prose. `colour`, `finalise`, `organisation`,
  `authorisation`. Applies to docs, comments, docstrings, UI copy.
- **Tests alongside code.** New feature → new test. Fixes → regression
  test.
- **Env vars.** Never `process.env.X` directly in components. Route
  through `apps/web/src/lib/env.ts`. Same rule in Python — go through
  `app.core.config.get_settings()`.

---

## 4. The Learnings-doc contract

This is what makes the project a portfolio piece and a founder story.
**Every phase of work produces a `Project_Docs/Learnings/Phase_N_.../`
folder** with:

1. `01_overview.md` — what we built, why, and how it fits.
2. `02_..._walkthrough.md` — file-by-file explanation of the code.
3. `03_..._walkthrough.md` — one per meaningfully new component.
4. `CHALLENGES.md` — every real bump we hit, root cause, fix,
   interview lesson.
5. Interview Q&A embedded throughout — the kind of question a Stripe
   Dublin engineer or a VC would ask, with a crisp answer.

If a change is not documented, it is not done. The docs are the
**deliverable**, the code is the artefact that proves the docs are true.

---

## 5. Verification checklist (run before "done")

Before you claim a change works:

- **Frontend.** `pnpm dev` (or `npm run dev`) boots. `npx tsc --noEmit`
  passes. If UI: opened in a browser and clicked through the golden path.
- **Backend.** `.venv` active. `uvicorn app.main:app --reload` boots.
  `pytest` green. `ruff check .` clean.
- **End-to-end.** For anything spanning both apps, hit the actual
  endpoint from the browser or `curl` and confirm the response.
- **Docs.** The relevant Learnings doc is updated in the same change.
- Only after all four → tell the user "done."

---

## 6. Ask-before-spending rules

Never do any of these without an explicit user confirmation:

- Create paid cloud resources (Supabase paid tier, Vercel Pro, Fly.io
  paid regions, Azure Document Intelligence subscription, Anthropic API
  usage above the smallest quota).
- Run more than **20 LLM calls** in a burst against a paid endpoint.
- Push to any git remote or open a PR.
- `git reset --hard`, `git push --force`, `rm -rf` inside the repo,
  drop DB tables, delete branches.
- Modify anything outside `EvidenceOS/` (the parent `DORA_SAAS/` folder
  and everything above it is out of scope).

Local, reversible actions (edit files, run tests, spin up dev servers,
add unpaid free-tier resources) — proceed and report.

---

## 7. Regulatory and data-handling rules

- **EU data residency.** All persistent data (Supabase, storage, LLM
  calls) must sit in EU regions (Frankfurt / Ireland). No US regions,
  ever, without an explicit ask.
- **PII / customer contract data.** Treat every uploaded document as
  containing GDPR special-category data by default. Do not log raw
  contents. Structured audit logs only (who, what, when, doc ID — never
  doc body).
- **Determinism gate.** Anything that decides "compliant / non-compliant"
  must be rule-based and testable. LLMs may **suggest**, **explain**,
  or **flag ambiguity** — they never decide.
- **Human-in-the-loop.** Nothing auto-finalises. Every recommendation
  needs a human "approve" event before it appears on the exported RoI.

---

## 8. Commit and PR etiquette

- Small, self-contained commits. One conceptual change each.
- Commit messages: `type(scope): imperative subject`, e.g.
  `feat(web): add upload page skeleton` or
  `docs(learnings): expand Phase 0 challenges with pip pin issue`.
- Body explains WHY, not what. The diff already shows what.
- Never commit without user asking. Never push without user asking.
  Never open a PR without user asking.
- When you commit on behalf of the user, always include:
  `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.

---

## 9. Tone in the workspace

- Terse over verbose. The user can read the diff.
- No trailing "in summary" paragraphs at the end of every message.
- If you are unsure, ask **one** sharp question rather than guess.
- If the user pushes back on an approach, save the reasoning as a
  feedback memory so we do not have that conversation twice.
