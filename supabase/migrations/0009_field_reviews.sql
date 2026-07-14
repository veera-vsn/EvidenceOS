-- 0009_field_reviews.sql
-- Human review of extracted DORA RoI fields (Phase 5).
--
-- One current-state row per (document_version, field) -- mirrors the same
-- upsert pattern already used by extraction_results and validation_results,
-- not an append-only history. A reviewer's second look at a field replaces
-- the row rather than adding to it; that is enough of an audit trail
-- (who reviewed it last, when, with what decision) for the human-in-the-loop
-- gate in CLAUDE.md 7 without the extra complexity of a history table
-- Phase 5 does not need yet.

create table public.field_reviews (
  id                   uuid        primary key default gen_random_uuid(),
  document_version_id  uuid        not null references public.document_versions(id) on delete cascade,
  field_code           text        not null,
  decision             text        not null check (decision in ('approved', 'edited', 'rejected')),
  -- Reviewer's corrected value. Required when decision = 'edited' -- an edit
  -- with no replacement value is meaningless; the CHECK constraint below
  -- makes that a schema-level guarantee, not just a UI convention.
  edited_value         text,
  -- Reviewer's reason. Required when decision = 'rejected' -- a rejection
  -- with no explanation leaves whoever fixes the source document with
  -- nothing to act on. Same reasoning CRITICALITY_VALUE's `message`
  -- follows in validation_results (Phase 4).
  notes                text,
  reviewed_by          uuid        not null references auth.users(id) on delete restrict,
  reviewed_at          timestamptz not null default now(),

  constraint field_reviews_version_field_unique
    unique (document_version_id, field_code),
  constraint field_reviews_edited_requires_value
    check (decision <> 'edited' or edited_value is not null),
  constraint field_reviews_rejected_requires_notes
    check (decision <> 'rejected' or notes is not null)
);

-- Index for the UI query: fetch all reviews for a document version in one hit.
create index field_reviews_version_idx
  on public.field_reviews (document_version_id);

-- RLS
alter table public.field_reviews enable row level security;

create policy "field_reviews_select_member"
  on public.field_reviews
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.document_versions dv
      join public.documents d on d.id = dv.document_id
      where dv.id = field_reviews.document_version_id
        and public.is_workspace_member(d.workspace_id)
    )
  );

-- Only reviewer/admin/owner may record a review decision -- not viewer.
-- has_workspace_role is exact-match only (no hierarchy), so all three are
-- OR'd explicitly, matching every other privileged policy in this schema.
create policy "field_reviews_insert_reviewer_admin_owner"
  on public.field_reviews
  for insert
  to authenticated
  with check (
    reviewed_by = auth.uid()
    and exists (
      select 1
      from public.document_versions dv
      join public.documents d on d.id = dv.document_id
      where dv.id = field_reviews.document_version_id
        and (
          public.has_workspace_role(d.workspace_id, 'reviewer')
          or public.has_workspace_role(d.workspace_id, 'admin')
          or public.has_workspace_role(d.workspace_id, 'owner')
        )
    )
  );

-- Upsert on the unique constraint hits UPDATE the second time a field is
-- reviewed, not INSERT -- same role gate applies there.
create policy "field_reviews_update_reviewer_admin_owner"
  on public.field_reviews
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.document_versions dv
      join public.documents d on d.id = dv.document_id
      where dv.id = field_reviews.document_version_id
        and (
          public.has_workspace_role(d.workspace_id, 'reviewer')
          or public.has_workspace_role(d.workspace_id, 'admin')
          or public.has_workspace_role(d.workspace_id, 'owner')
        )
    )
  )
  with check (reviewed_by = auth.uid());

-- No delete policy: rows are removed only via the on-delete-cascade FK when
-- the parent document is deleted -- same as extraction_results and
-- validation_results, neither of which has an explicit delete policy either.
