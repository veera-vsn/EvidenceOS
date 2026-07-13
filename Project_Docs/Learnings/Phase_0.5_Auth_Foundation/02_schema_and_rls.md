# 02 — Schema and Row-Level Security

Everything in `supabase/migrations/0001_workspaces.sql` explained.

---

## Mental model

Three tables, one enum, five functions, four triggers, ten policies.
They exist to enforce **one invariant**:

> A user can only see data belonging to a workspace they are a member of.

Everything below is either that invariant, or the plumbing that keeps
that invariant true when new users sign up and new workspaces are
created.

---

## The enum: `workspace_role`

```sql
create type public.workspace_role as enum ('owner', 'admin', 'reviewer', 'viewer');
```

- **`owner`** — created the workspace, or was transferred ownership.
  Can delete workspace, change any member's role, remove members.
- **`admin`** — day-to-day management. Can invite members and edit
  workspace settings, but cannot delete the workspace.
- **`reviewer`** — the person who approves RoI cells. Can read
  everything, can approve/reject recommendations. Cannot invite.
- **`viewer`** — read-only. Auditors, external reviewers, junior
  compliance staff.

Why an enum and not a `text` column with a `CHECK`? Enums are typed,
comparable, and PostgREST maps them to a TypeScript union
(`'owner' | 'admin' | 'reviewer' | 'viewer'`) automatically. Adding a
role later is a one-line `ALTER TYPE ... ADD VALUE`.

---

## Table: `profiles`

```sql
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

- **`id`** is `auth.users.id`. Same UUID, cascade delete. When a user
  deletes their account, their profile disappears.
- **`display_name`** is optional so we can pre-populate it in the
  trigger and let the user override it later.
- **`updated_at`** is kept fresh by a BEFORE-UPDATE trigger
  (`set_updated_at`) — the app never sets it, so the app cannot lie
  about it. That matters for audit.

**Why keep this table separate from `auth.users`?** Two reasons.
First, `auth.users` is Supabase's schema — we do not extend it
(portability, upgrades). Second, `auth.users` contains email and
hashed password; we do not want RLS policies on other tables to
join into it. `profiles` is our public-facing shadow.

---

## Table: `workspaces`

```sql
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users(id) on delete restrict
);
create index workspaces_created_by_idx on public.workspaces(created_by);
```

- **`id`** — UUID v4, random. Used everywhere in code; safe to expose.
- **`slug`** — human-readable URL segment, globally unique. Enables
  `/w/acme-bank/dashboard` instead of `/w/8f2a.../dashboard`. The
  unique constraint means we can look up by slug alone.
- **`created_by`** — the user who created the workspace. `ON DELETE
  RESTRICT` so the workspace outlives its founder (they can transfer
  ownership before leaving).
- **Index on `created_by`** — for "workspaces I created" queries.
  Cheap; better to add now than after we notice a slow query.

---

## Table: `workspace_members`

```sql
create table public.workspace_members (
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          public.workspace_role not null default 'viewer',
  joined_at     timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id);
```

- **Composite primary key** `(workspace_id, user_id)` — a user cannot
  be a member twice.
- **Cascade on both foreign keys** — delete the workspace or the
  user, the membership row goes with them.
- **`role` defaults to `viewer`** — safest default. New members are
  read-only until an owner promotes them.
- **Index on `user_id`** — supports "workspaces I belong to" queries,
  which every server-rendered page will do. The primary key already
  indexes `workspace_id` first, so no second index needed for
  workspace-side lookups.

---

## Trigger: keep `updated_at` fresh

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
```

- The function is generic. When we add more tables with
  `updated_at`, we reuse it.
- `set search_path = ''` is the Supabase-audited pattern — see
  `CHALLENGES.md` for the search-path escalation attack it blocks.

---

## Trigger: auto-create profile on signup

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

- Fires **inside the same transaction** as `INSERT INTO auth.users`.
  Either both rows exist or neither does. No half-registered users.
- Falls back to the email local part when the client did not supply a
  display_name — nicer than `NULL`.
- `SECURITY DEFINER` because the `auth.users` insert is done by the
  Supabase Auth service, not by the eventual user. The trigger must
  be able to write to `public.profiles` even though the invoking
  service does not directly have that grant.

---

## Trigger: auto-add workspace creator as owner

```sql
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_workspace_created
after insert on public.workspaces
for each row execute function public.handle_new_workspace();
```

- Solves a chicken-and-egg problem. The workspace has just been
  inserted; nobody is a member yet; the RLS INSERT policy on
  `workspace_members` requires the caller to be `owner`/`admin` of
  the target workspace. If we did this insert from application code,
  it would fail.
- `SECURITY DEFINER` runs the insert as the function owner
  (`postgres`), bypassing RLS. The workspace creator becomes the
  first owner atomically.

---

## Helper: `is_workspace_member`

```sql
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;
```

- Answers: "is the caller a member of this workspace?"
- `stable` — returns the same result for the same inputs within a
  single query, so Postgres can inline / memoise.
- `SECURITY DEFINER` — prevents recursion. When a policy on
  `workspaces` calls this, and this in turn queries
  `workspace_members`, without SECURITY DEFINER we would trigger
  `workspace_members`' own RLS check, which calls this function,
  which triggers RLS, ...

---

## Helper: `has_workspace_role`

Same shape as `is_workspace_member` but adds a role filter. Used by
UPDATE / DELETE policies to gate destructive changes to owners.

---

## Policies

Every policy targets the `authenticated` role. Anonymous users cannot
read anything — the entire product sits behind auth.

### `profiles`

| Policy | Effect |
|---|---|
| `profiles_select_self_or_shared_workspace` | You see yourself, and you see anyone who shares a workspace with you. |
| `profiles_update_self` | You can only edit your own row. |

No INSERT policy on purpose — the only insert path is the
`handle_new_user` trigger, which is SECURITY DEFINER. No DELETE
policy — deletion cascades from `auth.users`.

### `workspaces`

| Policy | Effect |
|---|---|
| `workspaces_select_member` | Members see their workspaces. |
| `workspaces_insert_authenticated` | Any signed-in user can create one (they will be auto-added as owner). |
| `workspaces_update_owner_admin` | Only owners and admins can edit. |
| `workspaces_delete_owner` | Only owners can delete. |

### `workspace_members`

| Policy | Effect |
|---|---|
| `workspace_members_select_same_workspace` | Members see their colleagues. |
| `workspace_members_insert_owner_admin` | Owners/admins invite others. First owner is inserted by the SECURITY DEFINER trigger, which bypasses this. |
| `workspace_members_delete_self_or_owner` | Users can leave; owners can remove others. |
| `workspace_members_update_owner` | Only owners can change roles. |

---

## Follow-up migration: `0002_revoke_helper_function_execute.sql`

Attempted the fix for the advisor warnings by revoking EXECUTE from
`anon` and `authenticated`. Did nothing. See `CHALLENGES.md` for why.

## Follow-up migration: `0003_revoke_helper_execute_from_public.sql`

Actually fixed it, by revoking from the `PUBLIC` pseudo-role. Advisor
report: zero lints. This is the working, audit-defensible state.

---

## Verification checklist

- [x] `list_tables` shows all three tables with `rls_enabled: true`.
- [x] `get_advisors` (security) returns `[]`.
- [x] ACL for each helper function no longer contains `=X/postgres`
      (the empty grantee that indicates PUBLIC has EXECUTE).
- [ ] Auth flow tests (Phase 0.5.5) prove tenants cannot see each
      other's data.

---

## What to read next

- `CHALLENGES.md` — the PUBLIC-role discovery, in full detail.
- `03_supabase_clients.md` — how the app talks to this schema.
