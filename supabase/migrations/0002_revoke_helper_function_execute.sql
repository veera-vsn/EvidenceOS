-- ============================================================================
-- 0002_revoke_helper_function_execute.sql
-- ----------------------------------------------------------------------------
-- Phase 0.5 — Auth foundation
--
-- Fixes the Supabase security advisor warnings for 0001_workspaces:
--
--   "Public Can Execute SECURITY DEFINER Function"
--   "Signed-In Users Can Execute SECURITY DEFINER Function"
--
-- All four SECURITY DEFINER functions in the public schema are automatically
-- exposed as PostgREST RPC endpoints (/rest/v1/rpc/<function_name>). Any
-- anon or authenticated caller could invoke them, which is not what we want:
--
--   handle_new_user       — only ever runs as an auth.users insert trigger.
--   handle_new_workspace  — only ever runs as a workspaces insert trigger.
--   is_workspace_member   — only ever used inside RLS policies.
--   has_workspace_role    — only ever used inside RLS policies.
--
-- We revoke EXECUTE from anon and authenticated. Triggers and internal RLS
-- calls still work because they run as the function owner, not as the API
-- caller.
-- ============================================================================

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.handle_new_workspace() from anon, authenticated;
revoke execute on function public.is_workspace_member(uuid) from anon, authenticated;
revoke execute on function public.has_workspace_role(uuid, public.workspace_role) from anon, authenticated;
