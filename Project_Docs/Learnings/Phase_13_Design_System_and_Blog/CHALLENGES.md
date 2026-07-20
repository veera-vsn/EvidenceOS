# Phase 13 (Design System + Blog) — Challenges

## C1 — Regenerating `database.types.ts` silently deleted the hand-maintained convenience aliases

**Symptom:** added the `newsletter_subscribers` migration, then ran
`npx supabase gen types typescript --local` to pick up the new table for
the blog's Server Action. The regeneration succeeded and included the
new table — but the very next `tsc --noEmit` produced ~50 errors across
almost every dashboard page: `Module has no exported member
'DocumentRow'`, `'WorkspaceRow'`, `'ValidationResultRow'`, and so on,
for types that had clearly existed and compiled cleanly minutes earlier.

**Root cause:** `database.types.ts` isn't purely generated — the bottom
third of the file is a hand-written, hand-maintained block of
convenience type aliases (`export type DocumentRow =
Database["public"]["Tables"]["documents"]["Row"]`, etc.) that every page
in the app imports instead of the verbose
`Database["public"]["Tables"]["foo"]["Row"]` path. `supabase gen types`
regenerates the *entire* file from the schema and has no knowledge of
that hand-written section, so a naive `> database.types.ts` redirect
overwrote it completely.

**Fix:** recovered the alias block from `git show HEAD:apps/web/src/lib/supabase/database.types.ts`
and re-appended it to the freshly generated file, adding one new line
for `NewsletterSubscriberRow`. Also hit a smaller, related snag getting
a clean regeneration: the Supabase CLI writes a `Connecting to db 5432`
status line to **stderr**, and running the gen-types command with
`2>&1 > file` merges that line into the file's first line, breaking the
TypeScript parse (`Unexpected keyword or identifier` at line 1) — fixed
by redirecting stdout only (`> file`, no `2>&1`) and separately
confirming with `2>/dev/null` that the clean version was what actually
got captured.

**Lesson:** a file whose header comment says "DO NOT EDIT BY HAND" can
still contain a *specific section* that's meant to be hand-edited and
preserved across regenerations — read the whole file (or diff before
overwriting) rather than trusting the header's blanket instruction, and
updated that header comment itself to call out the aliases section
explicitly so this doesn't repeat. More generally: any regeneration
command that redirects command output to overwrite a source file is
worth a `git diff --stat` sanity check on the result before moving on —
a ~600-line diff for "add one table" is a signal to actually look, not
just proceed because `tsc` happened to still fail loudly enough to
notice.

---

## C2 — Browser automation's `resize_window` doesn't change what CSS media queries see

**Symptom:** needed to verify the blog sidebar's mobile layout (a
horizontal pill-scroll bar replacing the full sidebar below the content
breakpoint). Called the browser tool's `resize_window` to 390×844 and
400×900, then screenshotted — both screenshots kept rendering the full
1536px-wide desktop layout.

**Root cause:** confirmed directly via `window.innerWidth` (the value
every Tailwind responsive class and CSS media query actually keys off)
immediately after the resize call: it stayed at `1536` regardless of the
requested resize dimensions. `resize_window` changed something about the
outer browser window in this environment without changing the value the
page's own layout engine reads to decide which responsive rules apply.

**Fix:** injected a temporary `<style>` tag via the JS-execution tool
that forced the specific responsive utility classes under test
(`.lg\:sticky`, `.lg\:hidden`) to their mobile-breakpoint state
regardless of actual viewport width, screenshotted to confirm the mobile
pill-scroll bar and hidden sidebar rendered correctly, then removed the
injected stylesheet. This verifies the component's conditional rendering
and the Tailwind class wiring are both correct, though it doesn't prove
the *exact* pixel breakpoint transition the way a genuinely resized
viewport would.

**Lesson:** when a tool's stated purpose (resize a window to test
responsive design) silently doesn't do the one thing that actually
matters for that purpose, verify the thing you actually care about
directly (`window.innerWidth`/`matchMedia` here) before trusting a
screenshot taken after using it. A screenshot that looks unchanged after
a resize call is ambiguous — it could mean "nothing broke" or it could
mean "the resize never happened" — and only checking the underlying
value distinguishes the two.

---

## What went right without incident

Every one of the ~15 existing pages touched by the `components/ui`
swap rendered pixel-identical (or a deliberately normalized, minor
improvement) to its pre-swap screenshot on the first attempt — a good
sign that the shared components' styles were transcribed carefully from
the real call sites rather than approximated. The MDX content pipeline
(`gray-matter` + `next-mdx-remote/rsc` + `remark-gfm`) worked correctly
on the first real build with zero configuration fighting, and the
newsletter Server Action's insert round-tripped to the local Supabase
database correctly on the first try.
