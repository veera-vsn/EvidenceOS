-- Migration 0007: extraction_results table
--
-- Stores the structured DORA RoI fields extracted from each document version
-- by the field extraction stage (Phase 3). One row per (document_version,
-- field_code) — the unique constraint enforces idempotency so the extractor
-- can be re-run safely via upsert.
--
-- Field codes follow the ESMA DORA ITS xBRL taxonomy identifiers
-- (e.g. 'b_01.01.0010' = contractual arrangement reference number).

create table public.extraction_results (
  id                  uuid        primary key default gen_random_uuid(),
  document_version_id uuid        not null references public.document_versions(id) on delete cascade,
  -- xBRL field identifier from the DORA ITS taxonomy.
  field_code          text        not null,
  -- Human-readable label for display in the UI.
  field_label         text        not null,
  -- Extracted value as plain text (dates, names, codes, flags, etc.).
  extracted_value     text,
  -- Confidence score 0.0–1.0 produced by the LLM.
  confidence          numeric(4,3) check (confidence >= 0 and confidence <= 1),
  -- Which method produced this ('claude-haiku', 'regex', 'manual').
  extraction_method   text        not null default 'claude-haiku',
  extracted_at        timestamptz not null default now(),
  constraint extraction_results_version_field_unique
    unique (document_version_id, field_code)
);

create index extraction_results_version_idx
  on public.extraction_results (document_version_id);

-- RLS: workspace members can read extraction results for their documents.
-- Writes are done by the service-role Python worker.
alter table public.extraction_results enable row level security;

create policy "extraction_results_select_member"
  on public.extraction_results
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.document_versions dv
      join public.documents d on d.id = dv.document_id
      where dv.id = extraction_results.document_version_id
        and public.is_workspace_member(d.workspace_id)
    )
  );
