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

## C3 — Every page hardcoded a narrow fixed max-width, and the background texture meant to fill the margin was invisible for two unrelated reasons

**Symptom:** user feedback after the redesign shipped: pages only used
the centre of the browser, with large flat empty margins on a real
1536px+ monitor, and the overall look read as generic/"AI-generated."

**Root cause, part 1 (layout):** every page's content column used a
fixed pixel `max-w-[...]` chosen without reference to real viewport
width -- `documents/page.tsx` at 1040px, `pipeline/page.tsx` at 1120px,
the blog shell at `max-w-5xl` (1024px), and so on. Centering content
under a max-width is correct practice for readability, but these widths
were noticeably narrower than they needed to be, so the empty margin on
a wide screen was much larger than intended.

**Root cause, part 2 (the fix for part 1's margin looked broken too):**
added a subtle dot-grid `background-image` on `body` to give that
margin texture instead of flat dead space. The computed style (checked
via `getComputedStyle(document.body).backgroundImage`) confirmed the
gradient was correctly applied from the very first attempt -- and it
was still completely invisible on screen, through three different alpha
values and a full dev-server restart (initially suspected a stale-CSS
caching issue, since this environment has a documented history of
serving stale code after a restart -- see `Phase_7_Deployment/CHALLENGES.md`
C9 and this phase's own C2). The actual cause: several top-level page
wrapper divs (`app/page.tsx`, `(blog)/layout.tsx`, `(legal)/layout.tsx`,
`dashboard/page.tsx`) set their *own* `bg-bg` background-colour on a
`min-h-screen` div sitting directly inside `<body>`. `body` already
supplies that same colour -- but because that child div paints a solid
colour with no image of its own, it sits in front of `body`'s
background-image in the paint order and fully occludes it. The gradient
was real and correctly computed the entire time; it was simply painted
over by a redundant, unnecessary duplicate background one level down in
the DOM.

**Fix:** widened every page's content max-width meaningfully (roughly
+150-200px each across the dashboard app pages; the blog shell from
1024px to 1280px, with the *article body's* prose specifically re-capped
at 720px in its own inner wrapper so long-form text didn't just stretch
to fill the wider shell -- a wider page and a wider paragraph are not
the same goal). Removed the redundant `bg-bg` from the four wrapper divs
so `body`'s background-image can actually reach the screen. Gave the dot
pattern its own dedicated `--grid-dot` token (rather than reusing
`--border`/`--border-2`, which are deliberately tuned to be nearly
invisible at rest) so it has real, chosen contrast instead of borrowed
contrast that happened to be wrong for this different purpose.

**Lesson:** two independent bugs can hide behind the same symptom.
`getComputedStyle` proving a rule is *applied* is not the same claim as
proving it's *visible* -- paint order and sibling/ancestor backgrounds
can silently occlude a correctly-computed style, and that's a different
failure mode from "the CSS never took effect" (which a dev-server
restart would actually fix, and this one didn't). When a style change
is invisible despite the computed value looking right, check what's
painted on top of it before concluding the value itself is wrong.

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
