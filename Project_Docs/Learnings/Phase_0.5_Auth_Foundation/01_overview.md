# Phase 0.5 — Auth foundation

Phase 0 gave us a walking skeleton with a fake `/health` handshake.
Phase 0.5 replaces that with a real one: a user can **sign up, create
a workspace, and land on a dashboard** that reads their own data
through Row-Level Security.

By the end of this phase, every RLS policy that governs the rest of
the product exists as code and as a test.

---

## What ships this phase

1. **Postgres schema** — three tables (`profiles`, `workspaces`,
   `workspace_members`) with foreign keys, indexes, an enum for
   roles, two update-triggers, and RLS enabled everywhere.
2. **RLS policies** — `SELECT / INSERT / UPDATE / DELETE` policies
   for each table, backed by two `SECURITY DEFINER` helper functions
   (`is_workspace_member`, `has_workspace_role`).
3. **Supabase clients** — typed factories in both apps:
   - Frontend: `@supabase/supabase-js` + `@supabase/ssr` for
     Server Components, Client Components, middleware, and Route
     Handlers.
   - Backend: `supabase-py` for admin/audit paths that need to run
     with the service role.
4. **Auth pages** — signup, login, logout, and a `/auth/callback`
   route for magic-link / OAuth returns.
5. **Protected route** — `/dashboard` server-renders the workspace
   name for the logged-in user, proving RLS works end-to-end.

Not shipping this phase: OAuth providers, invitations, workspace
switcher, avatar upload, service-role admin API. Those wait until we
have real customer needs.

---

## Design decisions we are committing to

Full rationale in `02_schema_and_rls.md` and (later)
`04_supabase_clients.md`. Highlights:

- **Auth methods.** Email + password to start, magic link ready via
  the same `/auth/callback` route. OAuth deferred — every enterprise
  buyer we spoke to at the DORA level wants email/password as the
  baseline. We can layer Microsoft SSO in Phase 3+ when we start
  selling.
- **Multi-tenancy.** Users belong to one or more workspaces via
  `workspace_members`. One workspace per customer entity. Roles:
  `owner`, `admin`, `reviewer`, `viewer` — enough granularity for
  the review workflow, not so much that we spend the whole phase
  arguing over permissions.
- **Session strategy.** Supabase issues a JWT in an httpOnly cookie.
  The `@supabase/ssr` package refreshes it on every request via Next
  middleware — Server Components read it, Client Components read it,
  API routes read it. One source of truth.
- **Backend auth verification.** For `apps/api` endpoints that need
  a user identity (Phase 1+), we forward the JWT and verify it
  against Supabase's JWKS. Not built this phase, but the client
  factory is written to support it.
- **Trigger-driven bootstrapping.** When a new user signs up,
  a Postgres trigger creates their `profiles` row. When a workspace
  is created, another trigger adds the creator to
  `workspace_members` as `owner`. This keeps the app code
  ignorant of the "on signup, also insert into X" chore.
- **`SET search_path = ''`.** Every `SECURITY DEFINER` function
  pins its search_path to empty and fully-qualifies every reference
  (`public.workspaces`, `auth.uid()`). This is the Supabase-audited
  pattern that prevents search-path escalation attacks.
- **Slug on workspaces.** A globally-unique text slug (`acme-bank`)
  as well as the UUID id, because the URL should read
  `/w/acme-bank/dashboard` rather than
  `/w/8f2a...4c/dashboard`. Costs one column and one unique index;
  buys years of nicer URLs.

---

## Interview / investor Q&A

**Q: Why not build your own auth?**
A: Auth is a solved, dangerous problem. Rolling your own is how you
become the headline of "Fintech leaks 50,000 credentials." Supabase
Auth is GoTrue under the hood — a battle-tested open-source JWT
issuer with EU hosting and audit logs. We inherit magic links,
password resets, MFA (Phase 3+), rate-limiting, breach detection.
Our differentiator is the DORA validation engine, not a login form.

**Q: Why Postgres RLS instead of enforcing in the API layer?**
A: RLS is defence-in-depth. Even if a service-role key leaks or an
API endpoint forgets a check, RLS still refuses to return another
tenant's data. Regulators love this: "how do you prove tenant A
cannot read tenant B's contracts?" — answer: "the database itself
refuses; here is the policy." Cheaper than five audit meetings.

**Q: Why `SECURITY DEFINER` helper functions?**
A: RLS policies are just SQL. If a policy on `workspaces` calls
`is_workspace_member(...)` which itself queries `workspace_members`,
that inner query would normally trigger `workspace_members`' own
RLS — potentially recursive. `SECURITY DEFINER` bypasses RLS for
the helper's internal query, giving us a clean logical primitive
without recursion. We pay for it by pinning `search_path = ''` so
no attacker can shadow `public.workspace_members` with a malicious
schema.

**Q: Why triggers for profile / owner creation?**
A: Two reasons. First: if application code is the only path that
inserts a `profiles` row, any code path that misses that step
leaves an orphan user. A trigger makes it a database invariant.
Second: `handle_new_user` runs inside the same transaction as
`INSERT INTO auth.users`, so either both succeed or both fail —
no half-registered users.

**Q: How do you test RLS?**
A: pytest against the backend (Phase 0.5.5 test file) uses two
Supabase sessions with different signed-in users, tries every
cross-tenant read/write, and asserts each one either returns empty
or raises a permission error. This is the compliance evidence the
auditor asks for.

---

## Files this phase introduces or changes

Migration (SQL source of truth in git):
- `supabase/migrations/0001_workspaces.sql`

Backend:
- `apps/api/app/core/supabase.py`
- `apps/api/app/core/config.py` (new settings)

Frontend:
- `apps/web/src/lib/supabase/client.ts`
- `apps/web/src/lib/supabase/server.ts`
- `apps/web/src/lib/supabase/middleware.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/signup/page.tsx`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/auth/callback/route.ts`
- `apps/web/src/app/(app)/dashboard/page.tsx`

Learnings:
- `01_overview.md` (this file)
- `02_schema_and_rls.md`
- `03_supabase_clients.md`
- `04_auth_pages.md`
- `CHALLENGES.md`

---

## What to read next

- `02_schema_and_rls.md` — the schema line by line and why every
  policy exists.
