# 001 — RLS helpers lost EXECUTE after PUBLIC revoke

**Date:** 2026-07-13  
**Area:** Postgres · Supabase RLS · Security migrations  
**Symptom:** Workspace listed in the database but dashboard showed "Create your first workspace" — empty, no error.

---

## What happened

Migration `0003` revoked EXECUTE on helper functions from the `public`
pseudo-role to silence Supabase security advisor warnings. This
inadvertently removed EXECUTE from the `authenticated` role too, because
`authenticated` (like every role) inherits from `public`.

RLS policies on the `workspaces` table call `public.is_workspace_member(id)`
inside their `USING` clause. When `authenticated` users had no EXECUTE on
that function, Postgres could not evaluate the policy. Its response: treat
the expression as `false` — make the rows invisible, raise no error.

---

## The two permission concepts that must both be true

| Concept | What it controls | Requires |
|---------|-----------------|----------|
| `EXECUTE` privilege | Can the caller *invoke* the function? | Caller's role must have EXECUTE |
| `SECURITY DEFINER` | What the *body* can access once running | Runs as function owner — bypasses RLS |

These are orthogonal. Both must be satisfied. We had the SECURITY DEFINER
side right from day one. We broke the EXECUTE side in migration 0003.

---

## Debugging steps

1. User reports workspace visible in DB but not on dashboard.
2. Query `workspaces` + `workspace_members` via Supabase MCP SQL — both rows exist, membership correct.
3. Attempt `SET LOCAL role TO authenticated; SELECT public.is_workspace_member(...)` — got `permission denied for function`.
4. Check `pg_proc.proacl` — confirmed `authenticated` had no EXECUTE entry.

---

## Fix

Migration `0004_grant_helper_execute_to_authenticated.sql`:

```sql
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, public.workspace_role) TO authenticated;
```

ACL after fix — `anon` absent (advisor stays clean), `authenticated` restored:
```
{postgres=X/postgres, service_role=X/postgres, authenticated=X/postgres}
```

---

## Rule to carry forward

> Any time you REVOKE from PUBLIC, ask: does any RLS policy or trigger
> that the app relies on call this function from a user session?
> If yes — GRANT selectively to the roles that legitimately need it.

- Trigger functions (`handle_new_user`, `handle_new_workspace`) need no
  grant — only Postgres fires them, never a user session.
- RLS helper functions (`is_workspace_member`, `has_workspace_role`) need
  EXECUTE for `authenticated` — users hit them on every protected query.

---

## Interview answer

> "We had a silent RLS failure. A workspace was visible in the database
> but invisible in the UI. No error, no exception. The root cause was
> that we'd revoked EXECUTE on our RLS helper functions from the PUBLIC
> pseudo-role to fix a security advisor warning, not realising that
> `authenticated` inherits from PUBLIC and would lose the grant too.
> Postgres's deny-by-default RLS treats a non-executable policy
> expression as false — rows disappear rather than throwing. We
> diagnosed it by calling the function directly as the `authenticated`
> role and getting 'permission denied'. The fix was a single GRANT
> EXECUTE TO authenticated in a new migration."
