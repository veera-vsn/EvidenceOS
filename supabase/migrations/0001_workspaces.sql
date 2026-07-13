-- ============================================================================
-- 0001_workspaces.sql
-- ----------------------------------------------------------------------------
-- Phase 0.5 — Auth foundation
--
-- Introduces the multi-tenancy skeleton: profiles, workspaces, and the
-- workspace_members join table. Adds row-level security policies for every
-- table plus two SECURITY DEFINER helper functions so policies stay
-- readable.
--
-- Triggers auto-create the profiles row on signup and auto-add the workspace
-- creator as owner. Both are idempotent inside their own transaction.
--
-- Every SECURITY DEFINER function pins search_path = '' and fully qualifies
-- schema references. This is the Supabase-audited pattern that blocks
-- search-path escalation.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enum: workspace roles
-- ----------------------------------------------------------------------------

create type public.workspace_role as enum ('owner', 'admin', 'reviewer', 'viewer');

-- ----------------------------------------------------------------------------
-- Table: profiles
--
-- Public-facing user data, one row per auth.users row. We keep auth.users
-- opaque to the application layer and read display_name / avatar from here.
-- ----------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile per user. auth.users stays opaque; this is what the app reads.';

-- ----------------------------------------------------------------------------
-- Table: workspaces
--
-- One workspace per customer entity (payment institution, bank, insurer).
-- The slug drives URL routing (/w/acme-bank/...) and must be globally unique.
-- ----------------------------------------------------------------------------

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users(id) on delete restrict
);

create index workspaces_created_by_idx on public.workspaces(created_by);

comment on table public.workspaces is
  'One row per customer financial entity. slug is used for URL routing.';

-- ----------------------------------------------------------------------------
-- Table: workspace_members
--
-- Many-to-many between users and workspaces, with role.
-- ----------------------------------------------------------------------------

create table public.workspace_members (
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          public.workspace_role not null default 'viewer',
  joined_at     timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members(user_id);

comment on table public.workspace_members is
  'Membership + role. Composite PK prevents duplicate memberships.';

-- ----------------------------------------------------------------------------
-- Function: set_updated_at
--
-- Generic BEFORE UPDATE trigger to keep updated_at fresh.
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- Function: handle_new_user
--
-- Fires after INSERT on auth.users. Creates a profiles row with a sensible
-- default display_name (from raw_user_meta_data.display_name if provided,
-- else the local part of the email).
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- Function: handle_new_workspace
--
-- Fires after INSERT on workspaces. Adds the creator to workspace_members
-- as owner. Because the function is SECURITY DEFINER, it bypasses the RLS
-- insert policy on workspace_members — otherwise the very first membership
-- row would fail (there is nobody with permission to insert it yet).
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- Function: is_workspace_member
--
-- Returns true if the current auth user is a member of the given workspace.
-- SECURITY DEFINER lets this run without triggering RLS recursion when
-- called from inside a workspaces or workspace_members policy.
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- Function: has_workspace_role
--
-- Returns true if the current auth user holds `required_role` (or higher,
-- in future) in the given workspace. Today we compare exactly; when we
-- introduce hierarchy we bump this function.
-- ----------------------------------------------------------------------------

create or replace function public.has_workspace_role(
  target_workspace_id uuid,
  required_role public.workspace_role
)
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
      and wm.role = required_role
  );
$$;

-- ----------------------------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Profiles: user can read their own row + rows of anyone in a shared workspace.
create policy "profiles_select_self_or_shared_workspace"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members me
    join public.workspace_members them
      on them.workspace_id = me.workspace_id
    where me.user_id = auth.uid()
      and them.user_id = public.profiles.id
  )
);

-- Profiles: user can update only their own row.
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Workspaces: members can read their workspaces.
create policy "workspaces_select_member"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));

-- Workspaces: any authenticated user can create a workspace (they become owner
-- via the on_workspace_created trigger).
create policy "workspaces_insert_authenticated"
on public.workspaces
for insert
to authenticated
with check (created_by = auth.uid());

-- Workspaces: only owners or admins can update.
create policy "workspaces_update_owner_admin"
on public.workspaces
for update
to authenticated
using (
  public.has_workspace_role(id, 'owner')
  or public.has_workspace_role(id, 'admin')
)
with check (
  public.has_workspace_role(id, 'owner')
  or public.has_workspace_role(id, 'admin')
);

-- Workspaces: only owners can delete.
create policy "workspaces_delete_owner"
on public.workspaces
for delete
to authenticated
using (public.has_workspace_role(id, 'owner'));

-- Workspace members: readable to members of the same workspace.
create policy "workspace_members_select_same_workspace"
on public.workspace_members
for select
to authenticated
using (public.is_workspace_member(workspace_id));

-- Workspace members: only owners/admins can invite new members.
-- The on_workspace_created trigger uses SECURITY DEFINER so it bypasses this,
-- letting the workspace creator become the very first owner.
create policy "workspace_members_insert_owner_admin"
on public.workspace_members
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, 'owner')
  or public.has_workspace_role(workspace_id, 'admin')
);

-- Workspace members: users can leave; owners can remove others.
create policy "workspace_members_delete_self_or_owner"
on public.workspace_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.has_workspace_role(workspace_id, 'owner')
);

-- Workspace members: only owners can change roles.
create policy "workspace_members_update_owner"
on public.workspace_members
for update
to authenticated
using (public.has_workspace_role(workspace_id, 'owner'))
with check (public.has_workspace_role(workspace_id, 'owner'));
