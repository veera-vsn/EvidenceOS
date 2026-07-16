-- 0010_entity_profile.sql
-- Full RoI Stage 2B: the filer's own entity identity (Phase 11).
--
-- Everything before this migration is either AI-extracted from a vendor
-- document (extraction_results) or a human decision about that extraction
-- (field_reviews). entity_profiles/entity_branches are neither -- they are
-- the filer's own organisation, entered once in workspace settings and
-- reused across every export (EBA tables B_01.01/B_01.02/B_01.03, plus the
-- B_03.01/B_03.02/B_04.01 rows derived from this data at export time -- see
-- apps/api/app/pipeline/entity_export.py). No confidence score, no
-- reviewer decision: this is user-entered settings data, not a pipeline
-- stage, so it deliberately does not follow the extraction_results /
-- validation_results / field_reviews shape.

create table public.entity_profiles (
  id                     uuid        primary key default gen_random_uuid(),
  workspace_id           uuid        not null references public.workspaces(id) on delete cascade,
  lei                    text        not null,
  name                   text        not null,
  country                text        not null,
  entity_type            text        not null,
  competent_authority    text        not null,
  -- B_01.02 columns 0100/0110 -- not on B_01.01, genuinely new data,
  -- optional since not every filer will have this figure to hand
  -- immediately.
  total_assets           numeric,
  total_assets_currency  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid        not null references auth.users(id) on delete restrict,

  -- One profile per workspace -- "you are one organisation" (see
  -- 01_overview.md for why genuine multi-entity groups are out of scope
  -- until real customer signal).
  constraint entity_profiles_workspace_unique unique (workspace_id)
);

comment on table public.entity_profiles is
  'The filer''s own entity identity (EBA table B_01.01), entered once per workspace.';

create trigger entity_profiles_set_updated_at
before update on public.entity_profiles
for each row execute function public.set_updated_at();

create table public.entity_branches (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  branch_code  text        not null,
  name         text        not null,
  country      text        not null,
  created_at   timestamptz not null default now()
);

create index entity_branches_workspace_idx on public.entity_branches(workspace_id);

comment on table public.entity_branches is
  'Branches of the filer''s own entity (EBA table B_01.03) -- optional, zero or more per workspace.';

-- RLS
alter table public.entity_profiles enable row level security;
alter table public.entity_branches enable row level security;

-- Entity profile: readable by any workspace member (same as workspaces
-- itself), writable only by owner/admin -- matches
-- workspaces_update_owner_admin's precedent exactly, since this is
-- workspace identity, not a reviewer-level action like field_reviews.
create policy "entity_profiles_select_member"
  on public.entity_profiles
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "entity_profiles_insert_owner_admin"
  on public.entity_profiles
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.has_workspace_role(workspace_id, 'owner')
      or public.has_workspace_role(workspace_id, 'admin')
    )
  );

create policy "entity_profiles_update_owner_admin"
  on public.entity_profiles
  for update
  to authenticated
  using (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  )
  with check (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

create policy "entity_profiles_delete_owner_admin"
  on public.entity_profiles
  for delete
  to authenticated
  using (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

-- Entity branches: same read/write shape as entity_profiles.
create policy "entity_branches_select_member"
  on public.entity_branches
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "entity_branches_insert_owner_admin"
  on public.entity_branches
  for insert
  to authenticated
  with check (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

create policy "entity_branches_delete_owner_admin"
  on public.entity_branches
  for delete
  to authenticated
  using (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

-- No update policy on entity_branches -- branches are add/remove only in
-- the settings UI (Phase 11), not edited in place; a correction is a
-- delete + re-add, same "no update path" precedent as
-- extraction_results/validation_results.
