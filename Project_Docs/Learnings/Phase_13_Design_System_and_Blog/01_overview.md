# Phase 13 — Design system consolidation + public blog

## What we built

Three things, done together because the second and third depend on the first:

1. **A reusable frontend design skill** (`.claude/skills/frontend-enterprise-design/`)
   — codifies the principles this phase was built against: honor an
   existing token system rather than replacing it, apply consistent
   primitives across a whole app rather than per-page reinvention, real
   loading/empty/error states, and a specific content-sidebar spec
   (`references/sidebar-patterns.md`) covering sticky positioning,
   progressive disclosure, and mobile stacking. Hand-authored using
   `skill-creator`'s SKILL.md format and writing conventions, not its
   full multi-iteration eval/benchmark loop — that loop is built for
   tuning a skill's trigger accuracy across many future sessions, which
   wasn't the goal here (the goal was applying it immediately, once).

2. **A shared `components/ui/` layer** (`apps/web/src/components/ui/`) —
   `Logo`, `Button`, `Input`/`Select`/`FieldLabel`, `Alert`, `Badge`,
   `Card`, `EmptyState`, `Skeleton`. Before this phase, none of these
   existed as shared components: the logo mark was hand-copy-pasted with
   three slightly different pixel values across 5 files, buttons/inputs/
   alerts were repeated with near-identical but not identical Tailwind
   strings across auth/settings/review, and status-pill logic was
   reimplemented per page (`VersionBadge`, `RUN_STATUS_STYLES`,
   `ValidationBadges` all independently invented the same "tone → style"
   lookup table pattern). Every existing hand-rolled instance was swapped
   to the shared component in the same pass — a component nobody uses
   yet doesn't fix the inconsistency it targets.

   Deliberately **not** forced into a shared component: the Review
   page's `FieldReviewCard` segmented approve/edit/reject control (a
   different, denser visual role with keyboard-shortcut data-attribute
   hooks), the export page's rectangular file-type tags and the pipeline
   page's icon-square stage pips (both a different shape than a status
   pill), and the export page's actual `.zip` download link (kept as a
   plain `<a>`, not `Button`'s `href`-as-`<Link>` path, since `Link`
   prefetches on hover — undesirable for a file download).

3. **A public blog** (`apps/web/src/app/(blog)/`) — file-based MDX
   content (`content/blog/*.mdx`, parsed with `gray-matter`, rendered
   with `next-mdx-remote/rsc`), four launch articles grounded in facts
   already established elsewhere in this codebase (the EBA dry-run stat,
   the 116 checks, the RTS template references), a content sidebar built
   to the skill's own sidebar-patterns spec (sticky, search via a plain
   `?q=` GET form, a newsletter signup, latest posts, a collapsible
   category list, a compact author card, mobile pill-scroll instead of a
   full stack-below-the-article), an in-house newsletter capture (new
   `newsletter_subscribers` Supabase table + Server Action — no
   third-party ESP, see below), per-article OG images reusing the
   existing `opengraph-image.tsx` pattern, and `sitemap.ts`/`robots.ts`.

Also touched as part of applying the above consistently: the landing
page, both auth pages, both legal pages (their duplicated `H2`/`P`/`Li`
prose helpers consolidated into `components/ui/legal-prose.tsx`), and
`loading.tsx` skeleton states added to the Documents/Pipeline/Review
list pages — nothing in this app had a loading state of any kind before
this phase; every async page just awaited server-side with a blank
screen in between.

**Follow-up after first real user feedback**: the initial pass still
read as too narrow on a real wide monitor -- every page centred its
content under a fixed pixel max-width chosen without reference to actual
viewport width (documents at 1040px, the blog shell at 1024px, etc.),
leaving large flat margins on anything wider than ~1400px. Widened every
page's content column (roughly +150-200px each across the dashboard app;
the blog shell to 1280px, with the article body's actual prose re-capped
separately at 720px so long-form text didn't just stretch to match --
a wider *page* and a wider *paragraph* are different goals). Also added
a full-page dot-grid background texture so the margin that remains
reads as a deliberate layout choice rather than dead space -- see
`CHALLENGES.md` C3 for why that texture was invisible on the first two
attempts despite `getComputedStyle` confirming it was correctly applied
the whole time.

## Why no third-party newsletter ESP

The newsletter signup writes to a plain Supabase table
(`supabase/migrations/0012_newsletter_subscribers.sql`), not Mailchimp/
ConvertKit/Buttondown/etc. This project's stated rule is EU data
residency for all persistent data (see `CLAUDE.md` and the Privacy
Policy's subprocessor list) — adding a mailing-list vendor for what is,
at this stage, a simple email-capture form would mean a new
subprocessor and a Privacy Policy update for a feature that a
same-region Postgres table already handles completely. RLS is
insert-only for `anon`/`authenticated`; only `service_role` can read the
list back out, matching the "public can write, nobody but us can read"
shape the table actually needs.

## Why the blog overrides the root layout's `noindex`

`apps/web/src/app/layout.tsx` sets a blanket `robots: { index: false,
follow: false }` — a deliberate pre-launch flag, since the app itself
(dashboard, auth) shouldn't be indexed yet. The blog is the one part of
the site meant to be public and crawlable from day one (that's the
entire point of a content-marketing blog), so
`app/(blog)/blog/[slug]/page.tsx`'s `generateMetadata` and
`app/(blog)/blog/page.tsx`'s static `metadata` both explicitly set
`robots: { index: true, follow: true }`, and `robots.ts` allows `/blog`
explicitly while disallowing `/dashboard`, `/login`, `/signup`, `/auth`.
Also added `metadataBase` to the root layout while touching this file —
previously unset, which meant relative OG image URLs had been resolving
against `localhost:3000` in production builds (visible as a build-time
warning that's now gone).

## Verification

`npx tsc --noEmit` and `npx next build` after every sub-step (component
layer, blog feature, redesign pass), not just at the end. Real
browser click-through for: both auth pages and the settings form after
the primitive swap (pixel-identical to before), the Documents/Export
empty states, the blog list + one article at desktop width in dark
mode, the sticky sidebar and collapsible category accordion, the
newsletter form actually inserting a row into the local Supabase
database (confirmed via `docker exec ... psql`, then cleaned up), and
the mobile pill-scroll layout (see `CHALLENGES.md` for how, given a
real tooling limitation with viewport resizing in this environment).
