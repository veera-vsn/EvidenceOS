# Phase 1 — Schema Walkthrough

Migration file: `supabase/migrations/0005_documents_and_pipeline.sql`

---

## Enums

```sql
create type public.document_type  as enum ('pdf', 'docx', 'xlsx', 'csv');
create type public.upload_status  as enum ('uploading', 'uploaded', 'failed');
create type public.pipeline_run_status as enum ('queued', 'running', 'completed', 'failed');
create type public.stage_status   as enum ('pending', 'running', 'completed', 'failed', 'skipped');
```

Why enums rather than check constraints?

- They appear in the auto-generated TypeScript types from `generate_typescript_types`.
- They are self-documenting in the DB schema.
- Adding a new value requires an `ALTER TYPE … ADD VALUE` migration, which is
  a deliberate act — not a silent string that sneaks in via a bug.

---

## `documents`

```sql
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  file_type     public.document_type not null,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

Key decisions:

- `workspace_id` cascades on delete — deleting a workspace wipes its docs.
- `name` is the original filename, not sanitised. The sanitised version lives
  only in `storage_path` inside `document_versions`. Keeping the raw name
  lets us display it faithfully in the UI.
- `created_by` links to `auth.users`, not `workspace_members`, so we keep
  an audit trail even if the user later leaves the workspace.

RLS:

```sql
-- anyone who is a workspace member can see and insert documents
alter table public.documents enable row level security;
create policy "documents_select_member" on public.documents
  for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "documents_insert_member" on public.documents
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
```

---

## `document_versions`

```sql
create table public.document_versions (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.documents(id) on delete cascade,
  version_number int  not null default 1,
  storage_path   text not null,
  size_bytes     bigint,
  upload_status  public.upload_status not null default 'uploading',
  uploaded_by    uuid not null references auth.users(id),
  uploaded_at    timestamptz not null default now()
);
```

Why a separate versions table?

- DORA requires firms to track document history. If a supplier contract is
  re-uploaded after an amendment, both versions must be auditable.
- The pipeline can be run against a specific version, not just the latest,
  so results are reproducible.

`size_bytes` is nullable — it is filled in by `confirmUpload` after the
browser reports the file size. It is unknown during the `uploading` phase.

`storage_path` convention: `{workspaceId}/{documentId}/{versionNumber}/{safeFilename}`
The workspace ID as the first segment is what Storage RLS reads.

---

## `pipeline_runs`

```sql
create table public.pipeline_runs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status       public.pipeline_run_status not null default 'queued',
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz,
  updated_at   timestamptz not null default now()
);
```

`started_at` and `completed_at` are nullable — they are set by the worker
as it transitions the run through its lifecycle. The web app only creates
the row in `queued` state.

---

## `pipeline_run_documents`

```sql
create table public.pipeline_run_documents (
  pipeline_run_id     uuid not null references public.pipeline_runs(id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id),
  ocr_status          public.stage_status not null default 'pending',
  extraction_status   public.stage_status not null default 'pending',
  normalisation_status public.stage_status not null default 'pending',
  validation_status   public.stage_status not null default 'pending',
  recommendation_status public.stage_status not null default 'pending',
  primary key (pipeline_run_id, document_version_id)
);
```

Each row represents one document within one run. The five stage columns track
progress independently — a document can have OCR completed while extraction
is still running.

Why one row per (run, version) rather than one row per (run, version, stage)?

- Fewer joins in the UI query.
- Atomic update per document per stage — the worker updates a single row.
- Adding a stage later requires an `ALTER TABLE ADD COLUMN`, which is safe
  in Postgres (no table rewrite for nullable columns).

---

## Storage bucket

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false,
  52428800,  -- 50 MB
  array['application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv']
);
```

`public = false` means objects are not accessible without a signed URL or
a valid JWT. Storage RLS (four policies: select / insert / update / delete)
enforces workspace membership on every operation.

Storage RLS path-parse trick:

```sql
(string_to_array(name, '/'))[1]::uuid
```

`name` in `storage.objects` is the full object path. Splitting on `/` and
taking element `[1]` (1-indexed in Postgres) gives us the first path segment,
which we cast to UUID. This is the `workspace_id` we embedded in the path
when we created the version row.

---

## Interview Q&A

**Q: Why use `gen_random_uuid()` instead of sequential IDs?**

A: UUIDs are safe to generate client-side, unpredictable (no enumeration
attacks), and merge-safe across environments. For a multi-tenant SaaS these
properties outweigh the slightly larger index size.

**Q: What prevents a user from uploading to another workspace's Storage path?**

A: Storage RLS. The insert policy calls `is_workspace_member(...)` with the
workspace ID extracted from the object path. Even if a client crafts a path
starting with a different workspace ID, Supabase will reject the upload
because the JWT's `auth.uid()` is not a member of that workspace.

**Q: Could you normalise stage statuses into a separate `pipeline_stages` table?**

A: Yes, but it would add complexity for no current benefit. We have exactly
five fixed stages defined by the DORA pipeline spec. A separate table would
need five rows per document per run, a join on every read, and more migration
work. The current schema is simpler and still allows independent per-stage
updates. We would refactor if stages became dynamic.
