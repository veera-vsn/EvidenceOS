# Phase 0 — Challenges and how we solved them

These are the actual bumps we hit during Phase 0. Great material for
"tell me about a time you debugged something" interview questions.

---

## 1. `create-next-app` gave us Next 16, not Next 14

**What happened.** The plan said "Next.js 14" but `npx create-next-app@latest` installed 16.2.10 with React 19 and Tailwind v4.

**Why it matters.**
- App Router APIs changed between 14 and 15: `cookies()`, `headers()`, and `params` in page/layout components are now **async** (return `Promise<...>`). Any 14-era tutorial that does `const { id } = params` breaks.
- Tailwind v4 replaced `tailwind.config.js` with a CSS-first `@theme` block inside `globals.css`.

**How we handled it.**
1. Read `apps/web/node_modules/next/dist/docs/01-app/02-guides/upgrading/version-15.md` to confirm the async-request-APIs change. Also read `05-server-and-client-components.md` to confirm Server Components still work the same at the top level.
2. Adapted our layout and page code to the newer conventions from the start.
3. Documented the change in `00_STACK_DECISIONS.md` — the version bump does not invalidate any of our reasons for choosing Next.

**Interview lesson.** When a scaffolding tool gives you a newer version than expected, read the upgrade guide before writing code. The alternative — writing 14-era code and hitting async-Promise errors — wastes far more time than the 5 minutes it takes to skim the docs.

---

## 2. Pinned Python versions that did not exist

**What happened.** First `requirements.txt` pinned `pydantic==2.13.5` and `fastapi==0.121.2`. `pip install` failed with "Could not find a version that satisfies the requirement pydantic==2.13.5" — the latest 2.13.x was 2.13.4.

**Root cause.** I guessed at exact version numbers instead of letting pip's resolver pick them.

**How we fixed it.**
- Split the dependency file in two: `requirements.in` (human-edited, unpinned) and `requirements.txt` (`pip freeze` output).
- Install from `.in`, freeze into `.txt`. That guarantees `.txt` reflects real, installable versions.

**Long-term takeaway.** In regulated software you want *exact* pins for reproducibility, but you also want to bump them intentionally. The `.in` + freeze workflow is the industrial pattern (`pip-tools` automates it with `pip-compile`; we can adopt it later if manual freezing becomes noisy).

---

## 3. FastAPI TestClient deprecation warning

**What happened.** `pytest` passed but emitted:
```
StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
```

**Root cause.** Starlette's test client wraps httpx. Starlette maintainers are migrating to a fork called `httpx2` and warn on use of the older major.

**Decision.** Ignore for now.
- The warning does not affect behaviour — the test passes and the assertion holds.
- `httpx2` is not yet published on PyPI (as of our install), and swapping mid-scaffold introduces risk with zero benefit.
- We will revisit when Starlette actually drops `httpx` support (probably 2026-late).

**Interview lesson.** Not every warning deserves an immediate action. Read what the deprecation is really saying and weigh cost vs. benefit before chasing it.

---

## 4. Windows path handling

**What happened.** The environment is Windows 11 but the shell is bash. Some commands (`copy` vs `cp`, `.venv\Scripts\activate` vs `.venv/bin/activate`) need Windows-specific syntax.

**How we handled it.**
- Documented both variants in every README (`cp` / `copy`).
- Chose Python's `python -m venv` over `virtualenv` — bundled with the Python install, no extra tool required.

**Long-term.** The `scripts/dev.sh` we will add in Phase 6 will detect the platform and pick the right activation.

---

## 5. Deciding whether to use `create-next-app` or hand-scaffold

**Tension.** For learning, hand-scaffolding every file explains more. But `create-next-app` produces the industry-standard baseline that recruiters and future contributors expect.

**Resolution.** Use `create-next-app` for the initial tree, then rewrite `page.tsx`, `layout.tsx`, `globals.css` from scratch with our own comments and remove the Vercel demo assets. Best of both — familiar tooling, custom explanations.

---

## Nothing that made us change stack

Notably: nothing in Phase 0 caused us to reconsider a stack choice. Postgres, FastAPI, Next.js, Tailwind, Supabase all remain the right calls. If a scaffold problem had exposed a fundamental gap ("Tailwind v4 broke shadcn" for example), the answer would go in `00_STACK_DECISIONS.md`, not here.
