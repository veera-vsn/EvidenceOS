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
`SECURITY DEFINER`.

**⚠️ However, this broke RLS.** See Challenge #3 below — we did not
discover this until a user could not see their own workspace on the
dashboard.

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

## 3. Revoking EXECUTE from PUBLIC broke the RLS policies silently

**What happened.** After Challenges 1 & 2 fixed the advisor warnings,
everything compiled. But during end-to-end testing (Phase 0.5.5) a
workspace was created and appeared in the database — yet the dashboard
showed "Create your first workspace" as if the user had none.

No error appeared in the UI. The Supabase query returned `data: null`
silently. There was no exception, no 4xx, no log line.

**Root cause.** This is the missing half of the mental model from
Challenge 1.

A SECURITY DEFINER function has two separate permission boundaries:

| Boundary | Governs | Requirement |
|----------|---------|-------------|
| EXECUTE privilege | Can the caller *invoke* the function? | Caller's role must have EXECUTE |
| SECURITY DEFINER body | What *data* can the function body see? | Runs as owner, bypasses RLS |

We understood the second row (SECURITY DEFINER lets triggers write to
`workspace_members` without needing membership themselves). We missed
the first row.

When an RLS policy calls `public.is_workspace_member(id)`, Postgres
evaluates the expression in the *calling user's* security context. The
`authenticated` role must have EXECUTE on `is_workspace_member`. After
migration 0003 revoked from `PUBLIC`, `authenticated` no longer had it.

**What Postgres does when a policy function is not executable.** It
does not throw an error — it treats the expression as `FALSE`. The row
is not visible. From the application's perspective the table looks
empty. This is the "safe" default: deny over expose.

**The debugging path.**

1. Workspace and workspace_members rows confirmed in DB via Supabase
   MCP SQL.
2. Attempted to SET LOCAL role TO authenticated and call the function —
   got `permission denied for function is_workspace_member`.
3. That confirmed the `authenticated` role had no EXECUTE.

**The fix.** `0004_grant_helper_execute_to_authenticated.sql`:

```sql
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, public.workspace_role) TO authenticated;
```

ACL after fix:
```
{postgres=X/postgres, service_role=X/postgres, authenticated=X/postgres}
```

`anon` still has no EXECUTE — so the advisor warning stays resolved.
The two trigger functions (`handle_new_user`, `handle_new_workspace`)
do not need this grant because only Postgres fires them; users never
call them directly.

**Why the silent failure is by design.** Postgres RLS is designed to
be deny-by-default. A failed policy expression is equivalent to `false`,
not an error, so an attacker cannot enumerate RLS behaviour through
error messages. For developers this means: **a query returning empty is
not proof the query is correct** — it could be RLS silently blocking.

**Interview lessons.**

1. EXECUTE permission and SECURITY DEFINER are orthogonal concepts.
   You need EXECUTE to *call* the function; SECURITY DEFINER controls
   what the *body* can do once running.
2. RLS failures are silent — returning empty data, not errors. Always
   verify with direct SQL (as a service-role or postgres user) when a
   query returns unexpectedly empty results.
3. Any time you REVOKE from PUBLIC to satisfy a security advisor, ask:
   "does any policy or trigger that my app relies on call this
   function?" If yes, GRANT selectively to the roles that legitimately
   need it.
4. The migration sequence (0001 → 0002 → 0003 → 0004) is now a
   full worked example of iterative security hardening: discover,
   fix, discover the side-effect, fix that too.

---

## What did not go wrong

- The triggers. `handle_new_user` and `handle_new_workspace` fired
  on their first real invocation during signup and workspace creation.
  The SECURITY DEFINER path for the trigger body worked exactly as
  intended — `handle_new_workspace` was able to INSERT into
  `workspace_members` even though the calling user had no membership
  yet (and therefore would have been denied by the RLS INSERT policy).
- The migration ordering. `0001` → `0002` → `0003` → `0004` applied
  cleanly in sequence. Naming with monotonic prefixes worked as
  intended, and the history now reads as a complete debugging story
  rather than a clean-room implementation.
