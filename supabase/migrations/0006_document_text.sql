-- Migration 0006: document_text table
--
-- Stores the plain text extracted from each document version by the OCR
-- worker. One row per document_version — the worker writes here after
-- successfully completing the OCR stage.

create table public.document_text (
  id                  uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references public.document_versions(id) on delete cascade,
  -- Raw extracted text (may be very large for long PDFs).
  content             text not null,
  -- Word count for quick diagnostics without scanning content.
  word_count          int  not null default 0,
  -- Which extractor produced this (e.g. 'pymupdf', 'python-docx', 'openpyxl', 'csv').
  extractor           text not null,
  extracted_at        timestamptz not null default now(),
  constraint document_text_version_unique unique (document_version_id)
);

-- Index for fast look-ups by version when the extraction stage reads back.
create index document_text_version_idx on public.document_text (document_version_id);

-- RLS: workspace members can read extracted text for their documents.
-- Insert/update is done by the service-role key in the Python worker.
alter table public.document_text enable row level security;

create policy "document_text_select_member"
  on public.document_text
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.document_versions dv
      join public.documents d on d.id = dv.document_id
      where dv.id = document_text.document_version_id
        and public.is_workspace_member(d.workspace_id)
    )
  );
