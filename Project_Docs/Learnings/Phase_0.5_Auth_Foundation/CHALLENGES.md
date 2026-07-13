# Phase 0.5 — Challenges

Real bumps we hit and how we solved them. This is where "tell me
about a time you debugged something" answers come from.

---

## 1. Postgres's default `GRANT EXECUTE ... TO PUBLIC` invalidates
   per-role revokes

**What happened.** After applying `0001_workspaces.sql`, the Supabase
security advisor returned eight warnings, two per SECURITY DEFINER
function:

> Function `public.handle_new_user()` can be executed by the `anon`
> role as a `SECURITY DEFINER` function via `/rest/v1/rpc/handle_new_user`.
> Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not
> intentional.

We wrote `0002_revoke_helper_function_execute.sql`:

```sql
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.handle_new_workspace() from anon, authenticated;
revoke execute on function public.is_workspace_member(uuid) from anon, authenticated;
revoke execute on function public.has_workspace_role(uuid, public.workspace_role) from anon, authenticated;
```

Applied cleanly. Rechecked advisors: **same eight warnings**.

**Why it did not work.** Postgres's `CREATE FUNCTION` has a default
grant we did not know about. When you create a function without
specifying otherwise:

```
GRANT EXECUTE ON FUNCTION ... TO PUBLIC;
```

`PUBLIC` in Postgres is not a real role — it is a pseudo-role that
implicitly includes **every existing and future role**, including
`anon` and `authenticated`. So revoking from `anon` and `authenticated`
did nothing: they never had per-role grants; they inherited from
`PUBLIC`.

We confirmed by reading the actual ACL:

```sql
select proname, proacl::text as acl
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('handle_new_user', 'handle_new_workspace',
                  'is_workspace_member', 'has_workspace_role');
```

Result:

```
handle_new_user      | {=X/postgres, postgres=X/postgres, service_role=X/postgres}
handle_new_workspace | {=X/postgres, postgres=X/postgres, service_role=X/postgres}
is_workspace_member  | {=X/postgres, postgres=X/postgres, service_role=X/postgres}
has_workspace_role   | {=X/postgres, postgres=X/postgres, service_role=X/postgres}
```

The `=X/postgres` entry is the tell: the empty grantee before `=`
means `PUBLIC`. `X` means EXECUTE. `/postgres` is who did the grant.
So every function had EXECUTE granted to PUBLIC by the `postgres`
role at CREATE time.

**How we fixed it.** `0003_revoke_helper_execute_from_public.sql`:

```sql
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_workspace() from public;
revoke execute on function public.is_workspace_member(uuid) from public;
revoke execute on function public.has_workspace_role(uuid, public.workspace_role) from public;
```

Rechecked advisors: zero lints.
Rechecked ACL: `=X/postgres` gone.

```
handle_new_user      | {postgres=X/postgres, service_role=X/postgres}
```

Only the owner (`postgres`) and `service_role` retain EXECUTE.
Triggers still work because they run as the function's owner via
`SECURITY DEFINER`. RLS still works because the policies invoke the
helpers through the same owner path.

**Interview lessons.**

1. Postgres has default grants you cannot see from `CREATE
   FUNCTION` alone. Always read `pg_proc.proacl` after touching a
   function's permissions.
2. `PUBLIC` is not a real role. It is transitive. Revoking from
   specific roles does not remove `PUBLIC`-inherited access.
3. Advisors are your friend — they detect the effective permission,
   not the naive grant chain. If an advisor keeps complaining after
   a "fix," the fix is wrong, not the advisor.
4. Never modify a migration that has been applied. Add a new one.
   Migration history is audit evidence: it shows what we tried,
   what we learned, and what worked. In regulated software that
   history is a feature, not a bug.

---

## 2. `search_path = ''` is the search-path escalation defence

**What happened.** Nothing broken this time — we set
`SET search_path = ''` on every SECURITY DEFINER function without
thinking about it. Worth explaining the attack it blocks so we
remember to keep doing it.

**The attack.** Without pinning `search_path`, a `SECURITY DEFINER`
function inherits the *caller's* search_path. A malicious caller
could:

1. Create a schema they control, say `attacker`.
2. Create objects there that shadow the function's expected
   references — for example, an `attacker.workspace_members` table
   with a malicious trigger.
3. Prepend `attacker` to their session's `search_path`.
4. Call the SECURITY DEFINER function. The function's internal
   query `SELECT ... FROM workspace_members` now resolves to
   `attacker.workspace_members` — and runs with the elevated
   privileges of the function owner.

**The fix.** `SET search_path = ''` on the function, and
fully-qualify every reference (`public.workspace_members`,
`auth.uid()`). With an empty search_path, unqualified references
error out at parse time; the function cannot be tricked into
resolving to a shadowed table.

**Why this belongs in CHALLENGES.md.** It is the number-one hardening
step for Supabase Postgres. Every function we add for the rest of
the project will do this. Documenting the *why* here means we do not
have to re-derive it every phase.

**Interview lesson.** In regulated software you cannot only think
about what your code does — you also think about what a malicious
caller could make it do. The right defence is often one line
(`SET search_path = ''`) that costs nothing and blocks a whole class
of attack.

---

## What did not go wrong

- The RLS policies themselves. Every policy compiled and behaved as
  expected on first apply. We will verify multi-tenant isolation
  end-to-end in Phase 0.5.5 with two sessions and cross-tenant reads,
  but on inspection there are no bugs.
- The triggers. `handle_new_user` and `handle_new_workspace` fired
  on their first real invocation once we tested signup / workspace
  creation (Phase 0.5.5).
- The migration ordering. `0001` → `0002` → `0003` applied cleanly
  in order. Naming with monotonic prefixes worked as intended.
