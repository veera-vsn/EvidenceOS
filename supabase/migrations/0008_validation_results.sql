-- 0008_validation_results.sql
-- Stores per-field deterministic validation results from the ESMA quality
-- checks. One row per (document_version, field, rule) — idempotent on re-run.

create table public.validation_results (
  id                  uuid        primary key default gen_random_uuid(),
  document_version_id uuid        not null references public.document_versions(id) on delete cascade,
  field_code          text        not null,
  rule_id             text        not null,
  rule_label          text        not null,
  status              text        not null check (status in ('pass', 'fail', 'warning', 'skipped')),
  message             text,
  validated_at        timestamptz not null default now(),

  constraint validation_results_unique unique (document_version_id, field_code, rule_id)
);

-- Index for the UI query: fetch all results for a document version in one hit.
create index validation_results_version_idx
  on public.validation_results (document_version_id);

-- RLS
alter table public.validation_results enable row level security;

create policy "workspace members can read validation results"
  on public.validation_results
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.document_versions dv
      join public.documents d on d.id = dv.document_id
      where dv.id = validation_results.document_version_id
        and public.is_workspace_member(d.workspace_id)
    )
  );
