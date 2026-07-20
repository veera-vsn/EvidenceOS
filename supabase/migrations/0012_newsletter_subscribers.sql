-- ============================================================================
-- 0012_newsletter_subscribers.sql
-- ----------------------------------------------------------------------------
-- Blog newsletter capture (2026-07-20 blog launch).
--
-- Deliberately not a third-party ESP (Mailchimp/ConvertKit/etc.) -- this
-- project's stated rule is EU data residency for all persistent data, and
-- adding a third-party mailing list vendor would mean a new subprocessor
-- and a Privacy Policy update for what is, for now, a simple email capture
-- form. A plain table in the same EU-region Supabase project already in
-- the Privacy Policy's infra list needs neither.
--
-- No workspace/tenant scoping -- this is public blog readers, not
-- authenticated app users, so it sits outside the workspace model
-- entirely (unlike every other table in this schema).
-- ============================================================================

create table public.newsletter_subscribers (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique,
  subscribed_at  timestamptz not null default now()
);

comment on table public.newsletter_subscribers is
  'Blog newsletter signups. Public insert-only; no ESP, EU-region Postgres only.';

alter table public.newsletter_subscribers enable row level security;

-- Anyone (including anonymous blog readers) may subscribe. No select,
-- update, or delete policy exists for anon/authenticated -- only
-- service_role (used by whoever eventually exports the list to send an
-- email) can read it, matching the "public can write, nobody but us can
-- read" shape this table actually needs.
create policy "newsletter_subscribers_insert_anyone"
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (true);
