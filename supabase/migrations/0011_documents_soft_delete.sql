-- ============================================================================
-- 0011_documents_soft_delete.sql
-- ----------------------------------------------------------------------------
-- Documents soft-delete (2026-07-18 production audit fix, D1).
--
-- Every FK from documents cascaded on delete (document_versions,
-- extraction_results, validation_results, and -- critically --
-- field_reviews, the human review sign-off trail this whole product
-- exists to preserve). Any workspace owner/admin could hard-delete a
-- document and permanently destroy that trail with one click, no undo,
-- no recovery. See Project_Docs/AUDIT_2026-07-18.md D1.
--
-- Fix: "deleting" a document now sets deleted_at/deleted_by instead of
-- issuing a real DELETE. The documents_delete_owner_admin policy is
-- dropped entirely -- the authenticated role can no longer hard-delete a
-- documents row at all, at the database level, not just by app
-- convention. RLS select policy excludes soft-deleted rows, so a
-- "deleted" document disappears from every ordinary query without any
-- app-code changes (every read goes through the user's own session, not
-- service-role) -- only the underlying row, and everything that
-- references it, is actually preserved.
-- ============================================================================

alter table public.documents
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id) on delete restrict;

comment on column public.documents.deleted_at is
  'Soft-delete marker. Set instead of a real DELETE -- see this migration''s header.';

-- ----------------------------------------------------------------------------
-- Function: enforce_document_soft_delete_permission
--
-- Only an owner/admin may transition deleted_at from null to a timestamp
-- (or back to null, i.e. "undelete"). documents_update_member already lets
-- any workspace member update other columns (e.g. a future rename) -- RLS
-- alone can't express "this column may only change under this role"
-- without a trigger, since USING/WITH CHECK see the whole row, not a
-- per-column diff.
-- ----------------------------------------------------------------------------

create or replace function public.enforce_document_soft_delete_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    if not (
      public.has_workspace_role(new.workspace_id, 'owner')
      or public.has_workspace_role(new.workspace_id, 'admin')
    ) then
      raise exception 'Only a workspace owner or admin may delete or restore a document.';
    end if;
    new.deleted_by = case when new.deleted_at is null then null else auth.uid() end;
  end if;
  return new;
end;
$$;

create trigger documents_enforce_soft_delete_permission
before update on public.documents
for each row execute function public.enforce_document_soft_delete_permission();

-- ----------------------------------------------------------------------------
-- RLS: exclude soft-deleted rows from the default read path, and remove
-- the ability to hard-delete entirely.
-- ----------------------------------------------------------------------------

drop policy "documents_select_member" on public.documents;
create policy "documents_select_member"
on public.documents for select to authenticated
using (public.is_workspace_member(workspace_id) and deleted_at is null);

drop policy "documents_delete_owner_admin" on public.documents;
-- No replacement delete policy -- authenticated has no DELETE grant path
-- on this table any more. service_role (the pipeline worker) still
-- bypasses RLS entirely for legitimate internal maintenance.

-- ----------------------------------------------------------------------------
-- Function: soft_delete_document
--
-- Why a function, not a plain client-side UPDATE: PostgreSQL requires an
-- UPDATE's *resulting* row to also satisfy the table's SELECT policy, not
-- just the UPDATE policy's WITH CHECK. documents_select_member excludes
-- rows where deleted_at is not null -- so the moment a client-side update
-- sets deleted_at, the new row fails its own visibility check and
-- PostgreSQL rejects the whole statement with "new row violates row-level
-- security policy," for every caller, including an owner. (Found this the
-- hard way testing this exact migration -- confirmed by reproducing it
-- with an intentionally permissive `using (true) with check (true)`
-- UPDATE policy, which still failed until the SELECT policy's
-- `deleted_at is null` clause was loosened too.)
--
-- SECURITY DEFINER makes this run as the function's owner (the migration
-- role, which owns the table) -- PostgreSQL never applies RLS to a
-- table's owner, so the UPDATE inside this function sidesteps the
-- conflict entirely. Same precedent as handle_new_workspace() in
-- migration 0001 solving the equivalent chicken-and-egg problem for the
-- very first workspace_members row. The permission check itself still
-- lives in the trigger above (not duplicated here) -- triggers fire
-- regardless of which role performs the UPDATE, and auth.uid() still
-- resolves correctly inside a SECURITY DEFINER call since it reads a
-- session-level GUC, not the privilege-checking role.
-- ----------------------------------------------------------------------------

create or replace function public.soft_delete_document(target_document_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.documents
  set deleted_at = now()
  where id = target_document_id
    and deleted_at is null;
end;
$$;
