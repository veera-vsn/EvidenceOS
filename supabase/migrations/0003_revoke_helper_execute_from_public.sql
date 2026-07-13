-- ============================================================================
-- 0003_revoke_helper_execute_from_public.sql
-- ----------------------------------------------------------------------------
-- Phase 0.5 — Auth foundation
--
-- Actually fixes the advisor warnings 0002 tried to fix.
--
-- 0002 revoked EXECUTE from anon and authenticated. That was a no-op because
-- Postgres never granted per-role EXECUTE to those roles in the first place.
-- On CREATE FUNCTION, Postgres grants EXECUTE to the pseudo-role PUBLIC —
-- and PUBLIC transitively includes every role in the system, including anon
-- and authenticated. The advisor detects that effective permission and
-- (correctly) still complains.
--
-- The fix is to revoke from PUBLIC. Triggers and internal RLS calls are
-- unaffected because they run as the function owner (postgres role), which
-- retains its own EXECUTE grant.
--
-- Interview lesson captured in Phase_0.5/CHALLENGES.md.
-- ============================================================================

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_workspace() from public;
revoke execute on function public.is_workspace_member(uuid) from public;
revoke execute on function public.has_workspace_role(uuid, public.workspace_role) from public;
