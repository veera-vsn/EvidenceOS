---
name: frontend-enterprise-design
description: Use whenever building a new page/component, redesigning existing UI, or improving UX for a production web application — marketing sites, dashboards, admin panels, blogs, forms, settings pages, or any enterprise/SaaS surface. Covers design-token systems, component consistency across a whole app (not just one page), accessibility (WCAG AA), responsive/mobile layouts, sidebar and navigation patterns (including blog sidebars), empty/loading/error states, and motion restraint. Trigger this any time the user asks to "redesign," "make this look more professional/polished/enterprise-grade," "improve the UI/UX," build a new page or feature, or asks about sidebars, navigation, dashboards, tables, forms, or blog layouts — even if they don't say "design" explicitly. Also use it before shipping any user-facing page as a final quality bar check.
---

# Frontend Enterprise Design

A production SaaS/enterprise application is judged on whether every page feels like it came from the *same* product, built by people who sweat details — not on any single page looking clever in isolation. This skill is about achieving that consistency and polish across a whole codebase, not about generating one nice-looking screen.

## Core philosophy

**One system, applied everywhere — never reinvented per page.** The single biggest tell of an unpolished product is inconsistency: a button that's `rounded-lg` here and `rounded-full` there, three different greys that are all "supposed to be" the secondary text color, a sidebar pattern on one page and a totally different one on the next. Before touching any page, find the project's existing design tokens (a `globals.css` `@theme` block, a Tailwind config, a `tokens.ts`, a component library) and treat them as law. Extend the token set when something is genuinely missing (a spacing scale, an elevation level, a radius scale) — never invent one-off values inline (`className="rounded-[13px]"` sprinkled ad hoc is a smell; it belongs in a token).

**Redesign is refinement, not demolition, unless told otherwise.** If a design system already has real investment behind it (WCAG-passing contrast ratios that were hand-computed, a palette that matches shipped OG images and marketing assets, established component patterns), the default move is to *complete and extend* that system to places it hasn't reached yet, not replace it with something new that throws away that work. Flag it explicitly to the user if you think a wholesale visual change is warranted — don't silently overwrite a deliberate prior decision.

**Production quality bar, not demo quality.** Every page this skill touches should pass this checklist before being called done:
- Real loading, empty, and error states for every async view (not just the happy path)
- WCAG AA contrast (4.5:1 normal text, 3:1 large text/UI components) — verify with actual computed luminance, don't eyeball it
- Works at 375px width and at 1440px+, with no horizontal scroll on the body
- Keyboard-operable: every interactive element reachable by Tab, visible focus states, no keyboard traps, no `aria-disabled` on things that are actually still clickable (see `references/anti-patterns.md`)
- Respects `prefers-reduced-motion`
- Both color-scheme themes (light/dark) look intentional, not just inverted

## Design tokens: what a real system needs

Most projects start with just colors. A mature one has, at minimum:

| Category | Examples | Why it matters |
|---|---|---|
| Color | `bg`, `surface`, `surface-2`, `fg`, `fg-2`, `fg-3`, `border`, `border-2`, `accent`, semantic (`success`/`warning`/`danger`) | Foundation; get this right once, everything else derives from it |
| Type scale | A fixed set of sizes/weights (not arbitrary `text-[13.5px]` per component) | Prevents "every component picked its own font size" drift |
| Spacing | A scale (4/8/12/16/24/32/48...), not arbitrary pixel gaps | Makes rhythm consistent without a design tool |
| Radius | 2-3 steps (e.g. `sm`/`md`/`lg`), applied by role (inputs vs cards vs pills) | One rounding language across the app |
| Elevation | 1-2 shadow levels, used sparingly | Enterprise UIs favor borders over heavy shadows — reserve shadow for genuinely floating elements (modals, dropdowns, sticky bars) |
| Motion | A duration/easing pair or two (e.g. 150ms ease-out for hovers, 200ms for panel transitions) | Prevents each component inventing its own transition timing |

When auditing an existing codebase, grep for repeated inline magic numbers (`rounded-[`, `text-[`, arbitrary hex colors) — that's the signal of what should have been a token but isn't yet. Promoting those into the token system as you go is part of "redesign," not scope creep.

## Layout and responsive patterns

- Mobile-first, but for an enterprise/dashboard product, design the *desktop* information density deliberately too — enterprise users often have wide monitors and want to see more, not less, per screen (unlike a consumer landing page, which should breathe).
- Sidebars, secondary panels, and multi-column layouts collapse to a single column below your smallest supported breakpoint. Never let a fixed-width sidebar force horizontal scroll on mobile.
- Tables: on narrow viewports, either allow horizontal scroll *within the table's own container* (never the page body) or restructure rows into stacked key-value cards — pick one pattern and apply it everywhere tables appear, don't mix.
- Use `gap` on flex/grid containers for spacing between siblings, not margin on children — margins compound unpredictably as components get reused in new contexts.

## Sidebars and navigation

Read `references/sidebar-patterns.md` before building or redesigning any sidebar — content sidebar (blog, docs), app navigation sidebar (dashboard), or filter sidebar (search/listing page). The patterns differ by context and the reference file covers all three with concrete specs (widths, sticky offsets, mobile transformation).

## Empty, loading, and error states

Never ship a view that only handles the "data exists and the request succeeded" case:
- **Empty**: explain *why* it's empty and what to do next (an action, not just "No results"). A blank table with just a header row reads as broken, not empty.
- **Loading**: skeleton screens that match the real layout's shape beat spinners for anything that takes >300ms and has a predictable shape; a spinner is fine for short, shape-unpredictable waits.
- **Error**: state what went wrong in plain language and offer a concrete next step (retry, contact support, go back) — never a bare stack trace or raw API error string surfaced to the end user.

## Motion

Motion should clarify, not decorate. Good uses: a panel sliding in to show it came from a specific direction, a subtle fade on route transitions, a hover state confirming something is interactive. Bad uses: animating things just to have animated something, staggered entrance animations on every list item on every page load (charming once, exhausting on the fifth visit), anything that fires on every re-render instead of once on mount. Always gate non-essential motion behind `@media (prefers-reduced-motion: no-preference)`, and keep durations short (120-250ms for UI feedback; reserve anything longer for genuinely large, rare transitions).

## Accessibility checklist (run this on every page)

1. Every image has meaningful `alt` text (or `alt=""` if purely decorative)
2. Every form input has a associated, visible `<label>` — placeholder text is not a label
3. Color is never the *only* signal (status badges pair color with text/icon, not color alone)
4. Focus order matches visual order; nothing traps focus outside a modal's own boundary
5. Interactive elements are real interactive elements (`<button>`, `<a href>`) — not a `<div onClick>` with no keyboard handler
6. Contrast checked against the *actual* rendered background (including hover/pressed states), not just the default state

## Avoiding the "generic AI redesign" look

The same handful of patterns show up whenever a model redesigns something without a strong point of view, and they read as generic precisely because they're so common: everything centered, `rounded-lg` on every single element regardless of role, a purple-to-blue gradient hero, Inter/Space Grotesk as the default typeface with no pairing, emoji as section markers, a lone accent-color rail on every card, and heavy drop shadows on flat enterprise UI. None of these are wrong in isolation — they're wrong as an unexamined default. Before applying a pattern, ask whether it's the right choice for *this* product's actual content and audience, not just the first thing that comes to mind. Enterprise/compliance-facing products in particular tend to read as more credible with restraint: fewer colors, tighter type scale, borders over shadows, and density over whitespace-for-its-own-sake — a consumer-landing-page level of decoration on a compliance dashboard undermines trust rather than building it.

## Process for a full-app redesign

1. **Audit first.** Read the existing token file(s) and 3-4 representative pages (a marketing page, a dashboard/list page, a form, a detail/review page) before writing any code. Note what's already systematic vs. ad hoc.
2. **Extend the token set** for whatever's missing (spacing/radius/elevation/motion scales), keeping existing color tokens unless the user explicitly wants a palette change.
3. **Build/refresh shared primitives** (buttons, inputs, cards, badges, empty states) as reusable components if the codebase doesn't already have them — this is what makes the rest of the redesign consistent instead of page-by-page reinvention.
4. **Apply page by page**, grouping by area (marketing, auth, dashboard-app) so related pages get done together and stay consistent with each other.
5. **Verify in a real browser** at both a mobile and desktop viewport, in both color schemes, for every page changed — a passing type-check proves the code compiles, not that the UI looks or works right. Screenshot or click through the actual golden path, not just the component in isolation.
6. **Check against the production quality bar above** before calling any page done.
