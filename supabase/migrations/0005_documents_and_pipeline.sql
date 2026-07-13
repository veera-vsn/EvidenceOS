-- ============================================================================
-- 0005_documents_and_pipeline.sql
-- ----------------------------------------------------------------------------
-- Phase 1 — Document Upload + Pipeline Model
--
-- Introduces the raw source layer (documents, document_versions) and the
-- orchestration layer (pipeline_runs, pipeline_run_documents).
--
-- Design decisions:
--   * document  — the logical identity of a file. Renamed does not change id.
--   * document_version — immutable record of one upload. Never overwritten.
--     Auditors trace every extraction back to a specific version.
--   * pipeline_run — first-class domain concept. A run groups versions to
--     process together and tracks its lifecycle as a status machine.
--   * pipeline_run_documents — per-document per-stage progress. Allows
--     partial failures without poisoning the whole run.
--
-- Storage:
--   The Supabase Storage bucket 'documents' is created here. Objects live at:
--     {workspace_id}/{document_id}/{version_number}/{original_filename}
--   This prefix lets the RLS policy on storage.objects call
--   is_workspace_member() using the first path segment, the same helper
--   already in place since migration 0001.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type public.document_type as enum ('pdf', 'docx', 'xlsx', 'csv');

-- upload_status tracks whether the file made it into Storage.
-- 'uploading' is the transitional state between row creation and the
-- browser confirming the Storage upload completed.
create type public.upload_status as enum ('uploading', 'uploaded', 'failed');

-- pipeline_run_status mirrors a simple state machine:
-- queued → running → completed | failed
create type public.pipeline_run_status as enum ('queued', 'running', 'completed', 'failed');

-- stage_status is reused for each per-document pipeline stage column.
create type public.stage_status as enum ('pending', 'running', 'completed', 'failed', 'skipped');

-- ----------------------------------------------------------------------------
-- Table: documents
--
-- One row per logical file. Re-uploading a new version does NOT create a new
-- document row — it creates a new document_version row. This keeps the
-- document identity stable across re-submissions.
-- ----------------------------------------------------------------------------

create table public.documents (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  name          text        not null,
  file_type     public.document_type not null,
  created_by    uuid        not null references auth.users(id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index documents_workspace_id_idx on public.documents(workspace_id);

comment on table public.documents is
  'Logical file identity. Re-uploads create document_versions, not new documents.';

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: document_versions
--
-- Immutable once created. The storage_path is the Supabase Storage object
-- key. checksum (SHA-256 hex) lets workers detect corruption or deduplication.
-- ----------------------------------------------------------------------------

create table public.document_versions (
  id               uuid        primary key default gen_random_uuid(),
  document_id      uuid        not null references public.documents(id) on delete cascade,
  version_number   int         not null,
  storage_path     text        not null,
  size_bytes       bigint,
  checksum         text,
  uploaded_by      uuid        not null references auth.users(id) on delete restrict,
  upload_status    public.upload_status not null default 'uploading',
  created_at       timestamptz not null default now(),

  unique (document_id, version_number)
);

create index document_versions_document_id_idx on public.document_versions(document_id);

comment on table public.document_versions is
  'Immutable upload record. storage_path is the Supabase Storage object key.';

-- ----------------------------------------------------------------------------
-- Table: pipeline_runs
--
-- One run = one processing attempt over a set of document versions.
-- started_at / completed_at are set by the worker, not the web app.
-- ----------------------------------------------------------------------------

create table public.pipeline_runs (
  id            uuid                     primary key default gen_random_uuid(),
  workspace_id  uuid                     not null references public.workspaces(id) on delete cascade,
  status        public.pipeline_run_status not null default 'queued',
  created_by    uuid                     not null references auth.users(id) on delete restrict,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz              not null default now(),
  updated_at    timestamptz              not null default now()
);

create index pipeline_runs_workspace_id_idx on public.pipeline_runs(workspace_id);

comment on table public.pipeline_runs is
  'Orchestration unit. Groups document versions for a single processing attempt.';

create trigger pipeline_runs_set_updated_at
before update on public.pipeline_runs
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: pipeline_run_documents
--
-- Join table between a run and the documents it covers. Each row also tracks
-- per-stage progress so partial failures are visible at document granularity.
-- ----------------------------------------------------------------------------

create table public.pipeline_run_documents (
  pipeline_run_id       uuid not null references public.pipeline_runs(id) on delete cascade,
  document_version_id   uuid not null references public.document_versions(id) on delete cascade,

  -- Per-stage statuses. Workers update these individually as each stage
  -- completes. The web app reads them to render a progress breakdown.
  ocr_status            public.stage_status not null default 'pending',
  extraction_status     public.stage_status not null default 'pending',
  normalisation_status  public.stage_status not null default 'pending',
  validation_status     public.stage_status not null default 'pending',
  recommendation_status public.stage_status not null default 'pending',

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  primary key (pipeline_run_id, document_version_id)
);

create index prd_run_id_idx on public.pipeline_run_documents(pipeline_run_id);
create index prd_version_id_idx on public.pipeline_run_documents(document_version_id);

comment on table public.pipeline_run_documents is
  'Per-document, per-stage progress within a pipeline run.';

create trigger pipeline_run_documents_set_updated_at
before update on public.pipeline_run_documents
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------------------------

alter table public.documents           enable row level security;
alter table public.document_versions   enable row level security;
alter table public.pipeline_runs       enable row level security;
alter table public.pipeline_run_documents enable row level security;

-- Documents: workspace members can read; any member can insert; only the
-- creator or an owner/admin can delete.
create policy "documents_select_member"
on public.documents for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "documents_insert_member"
on public.documents for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = auth.uid()
);

create policy "documents_update_member"
on public.documents for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "documents_delete_owner_admin"
on public.documents for delete to authenticated
using (
  public.has_workspace_role(workspace_id, 'owner')
  or public.has_workspace_role(workspace_id, 'admin')
);

-- Document versions: readable + insertable by workspace members.
-- Never deleted individually (cascade from document delete covers cleanup).
create policy "document_versions_select_member"
on public.document_versions for select to authenticated
using (
  exists (
    select 1 from public.documents d
    where d.id = document_id
      and public.is_workspace_member(d.workspace_id)
  )
);

create policy "document_versions_insert_member"
on public.document_versions for insert to authenticated
with check (
  exists (
    select 1 from public.documents d
    where d.id = document_id
      and public.is_workspace_member(d.workspace_id)
  )
  and uploaded_by = auth.uid()
);

-- Only allow updating upload_status (the confirm-upload action).
create policy "document_versions_update_uploader"
on public.document_versions for update to authenticated
using (uploaded_by = auth.uid())
with check (uploaded_by = auth.uid());

-- Pipeline runs: readable + insertable by workspace members.
create policy "pipeline_runs_select_member"
on public.pipeline_runs for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "pipeline_runs_insert_member"
on public.pipeline_runs for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = auth.uid()
);

-- Workers update status; members can read.
create policy "pipeline_runs_update_member"
on public.pipeline_runs for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

-- Pipeline run documents: readable by workspace members; insertable at
-- run creation time; updated by workers via service role (bypasses RLS).
create policy "pipeline_run_documents_select_member"
on public.pipeline_run_documents for select to authenticated
using (
  exists (
    select 1 from public.pipeline_runs pr
    where pr.id = pipeline_run_id
      and public.is_workspace_member(pr.workspace_id)
  )
);

create policy "pipeline_run_documents_insert_member"
on public.pipeline_run_documents for insert to authenticated
with check (
  exists (
    select 1 from public.pipeline_runs pr
    where pr.id = pipeline_run_id
      and public.is_workspace_member(pr.workspace_id)
  )
);

-- ----------------------------------------------------------------------------
-- Supabase Storage bucket
-- ----------------------------------------------------------------------------

-- Create the private bucket. Objects are never public — presigned URLs are
-- used for browser uploads and downloads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,   -- 50 MB per file
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv'
  ]
)
on conflict (id) do nothing;

-- Storage RLS: objects live at {workspace_id}/{document_id}/{version}/{file}.
-- The first path segment is the workspace_id, which lets us reuse
-- is_workspace_member() to enforce the same tenant boundary as the DB tables.
create policy "storage_documents_select_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and public.is_workspace_member(
    (string_to_array(name, '/'))[1]::uuid
  )
);

create policy "storage_documents_insert_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents'
  and public.is_workspace_member(
    (string_to_array(name, '/'))[1]::uuid
  )
);

create policy "storage_documents_delete_owner_admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'documents'
  and (
    public.has_workspace_role(
      (string_to_array(name, '/'))[1]::uuid, 'owner'
    )
    or public.has_workspace_role(
      (string_to_array(name, '/'))[1]::uuid, 'admin'
    )
  )
);
