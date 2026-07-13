-- ============================================================================
-- 0004_grant_helper_execute_to_authenticated.sql
-- ----------------------------------------------------------------------------
-- Restore EXECUTE on the RLS helper functions for the `authenticated` role.
--
-- Root cause: migration 0003 revoked EXECUTE FROM public, which removed the
-- grant from *all* roles including `authenticated`. This silently broke every
-- RLS policy that calls is_workspace_member() or has_workspace_role(), because
-- Postgres evaluates policy expressions in the calling user's security context
-- — the function must be executable by that role even though it is SECURITY
-- DEFINER internally.
--
-- The Supabase advisor warning was specifically about `anon` being able to
-- call these functions via PostgREST RPC (/rpc/...). The correct fix is:
--   REVOKE from public (done in 0003)  →  blocks anon + authenticated
--   GRANT  to authenticated            →  restores RLS-only path
--
-- `anon` still has no EXECUTE grant, so the advisor warning stays resolved.
-- `authenticated` users can call them via RPC, but both functions use
-- auth.uid() internally so they can only inspect their own memberships —
-- the SECURITY DEFINER elevation adds nothing dangerous here.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, public.workspace_role) TO authenticated;
