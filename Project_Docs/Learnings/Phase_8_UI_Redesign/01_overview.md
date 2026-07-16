# Phase 8 — Compact, Anthropic-style redesign + mobile responsiveness

## Why

Direct user feedback on the Phase 7 UI: too much scrolling to approve a
field in Review, everything oversized, reads as "modern SaaS" rather than
"production-grade enterprise," too much decorative animation, and no real
mobile support (the sidebar was a fixed 236px flex child with no collapse
— unusable under ~600px). Explicit creative direction given twice: **"use
Anthropic Frontend Design"** — model the visual language on claude.ai's
own interface: sans-serif typography throughout (no display serif), a
warm neutral palette rather than cool grey, minimal decorative motion, and
dense-but-calm layouts.

## What changed

**Typography.** Removed the `Newsreader` serif font entirely — every
heading that used to pair a serif display face with sans-serif body text
now uses `font-sans` with weight (`font-semibold`/`font-bold`) doing the
hierarchy work instead. This was the single highest-leverage change:
claude.ai's own interface is sans-serif throughout, not a serif/sans
pairing.

**Colour.** Replaced the cool blue-grey token scale in `globals.css` with
warm neutrals (`--bg`, `--surface`, `--fg`, `--border`, etc., both light
and dark), keeping the existing teal accent and success/warning/danger
semantics unchanged — those were never the complaint.

**Review page — the specific "scroll to approve" fix.**
`field-review-card.tsx` was rewritten from a ~140-180px-tall bordered card
per field (value on one line, validation badges below a divider, then a
full-width three-button action row) to a compact single-row layout: field
code, label, value, confidence, validation badges, decision, and the
Approve/Edit/Reject buttons all on one row, wrapping only on narrow
viewports. A 25-field document now shows roughly 3x as many fields
without scrolling. The `submitFieldReview`/`useTransition`/keyboard-shortcut
wiring was reused unchanged — this was a layout change, not a logic change.

**Mobile drawer sidebar.** `dashboard/[workspaceSlug]/layout.tsx`'s
sidebar was a static flex child with no mobile behaviour at all. Added
`sidebar-shell.tsx`, a small new Client Component that renders the
sidebar off-canvas below `md` (768px), opened via a hamburger button in a
slim mobile top bar, and closes automatically on navigation (via
`usePathname()`) or by tapping the overlay. At `md` and above it's a
no-op passthrough — identical persistent sidebar to before. This is the
only new client-side state introduced in the whole redesign; a pure CSS
checkbox-hack drawer was considered and rejected because it wouldn't
auto-close after a Next.js client-side navigation (the layout persists
across route changes, so an uncontrolled checkbox's `checked` state would
persist too).

**Responsive grids and spacing pass.** Documents/Pipeline/Export/Review
and the landing/login/signup pages all got a systematic pass: container
horizontal padding drops from `px-10` to `px-5` below `sm`, the
Documents table (previously a fixed-pixel-column CSS grid that would
overflow on narrow screens) now stacks into a card layout below `sm` using
a `sm:contents` trick so the same DOM renders as either a flex-column card
or a grid row depending on breakpoint, and the Pipeline stage-status table
(fixed per-column widths that can't sensibly stack) got a horizontal-
scroll wrapper instead. The landing page's top nav — five items plus a
CTA button, which does not fit in 390px — now hides the three anchor
links (`hidden md:flex`) below `md`, keeping only Sign in / Get started.

**Animation.** Removed both `animate-pulse` instances (the running
pipeline-stage pip and the running-run status dot) and narrowed the
review progress bar's `transition-all duration-300` to
`transition-[width] duration-150` — functional-only, near-instant, per
the "no decorative motion" brief.

## Verification approach — and a real tooling gap

`npx tsc --noEmit` was run clean after every file group. Desktop (1440px+)
was verified directly via browser screenshots on every page, including
clicking into a real document's Review page and exercising the Edit
interaction end-to-end.

Mobile could **not** be verified by literally resizing the browser window
— `resize_window` changed `window.outerWidth` but never
`window.innerWidth`/the actual rendered viewport, in this environment (see
`CHALLENGES.md` C1). The workaround: inject a `<style>` tag plus targeted
class overrides that force the specific responsive rules to apply
regardless of true viewport width (e.g. forcing the sidebar drawer's
`isOpen` state and its `md:`-prefixed classes to render as they would
below 768px), screenshot, then remove the override and reload. This
proved the underlying transform/positioning/breakpoint logic renders
correctly without needing a genuinely narrow viewport — it does not
replace testing on a real device, which is the next thing to do before
this ships to production.
