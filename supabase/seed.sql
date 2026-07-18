-- Baseline grants that Supabase's hosted platform sets up automatically
-- when a project is first provisioned (schema usage + base table/sequence
-- privileges) -- never part of this project's own migration history
-- because they already existed before migration 0001 was written. Local
-- `supabase start`/`db reset` only replays 0001+, so without this seed
-- every table 403s for `authenticated`/`anon` with "permission denied"
-- even though RLS policies are otherwise correct. See
-- Phase_0.5_Auth_Foundation/CHALLENGES.md #5.
--
-- Deliberately excludes routines/functions: migrations 0002-0004
-- explicitly control EXECUTE on specific SECURITY DEFINER functions as a
-- hardening measure (revoking Postgres' default `GRANT EXECUTE ... TO
-- PUBLIC`), and a blanket grant here would silently undo that locally.
-- Table/sequence privileges are still filtered by RLS -- this only
-- clears the base-privilege check that comes before RLS is evaluated.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage on sequences to anon, authenticated, service_role;
