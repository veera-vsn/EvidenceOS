# Phase 8 (UI Redesign) — Challenges

Matching the format every earlier phase's `CHALLENGES.md` uses: symptom,
root cause, fix, lesson.

---

## C1 — `resize_window` doesn't actually resize the rendered viewport

**Symptom:** needed to verify the new mobile drawer sidebar and the
landing page's responsive nav at a genuinely narrow width. Called the
browser automation's `resize_window` tool with `width: 390`. The tool
reported success and `window.outerWidth` changed, but `window.innerWidth`
— the value Tailwind's `md:`/`sm:` media queries actually key off — stayed
at the original desktop width. Every screenshot taken afterwards still
rendered the desktop layout.

**Root cause:** unclear — likely the browser window in this environment is
in a state (maximized/snapped) that the extension's resize call can adjust
the window chrome for but not the actual content viewport. Confirmed by
checking `{innerWidth, outerWidth, screenWidth}` directly after a resize
call: `outerWidth` moved, `innerWidth` did not.

**Fix:** rather than relying on true viewport width, injected a temporary
`<style>` block plus targeted `classList.add()` calls that force the
specific `md:`/`sm:`-prefixed rules relevant to the component under test
to apply unconditionally (e.g. forcing the sidebar drawer's off-canvas
`aside` to render as `position: fixed` with the mobile transform, forcing
the landing nav's `hidden md:flex` block to actually hide). Screenshot,
verify, then remove the injected style and reload to restore the real
page state.

**Lesson:** this proves the *component logic and breakpoint wiring* is
correct — the CSS classes exist, target the right elements, and produce
the right visual result when active — but it is a proxy, not a substitute
for testing on an actual narrow viewport or device before shipping. Flag
this explicitly rather than silently treating the simulation as equivalent
to a real mobile pass.

---

## C2 — `sm:contents` for a table that needs to become a card on mobile

**Symptom:** the Documents page listed each document in a CSS grid with
fixed pixel columns (`grid-cols-[1fr_90px_90px_130px_40px]`) for
name/type/size/status/delete. That layout cannot sensibly reflow — fixed
pixel columns either overflow a 390px viewport or get so cramped they're
unreadable.

**Fix:** rather than duplicating the row markup for mobile vs desktop,
wrapped the type/size/status cells in a `<div>` with `sm:contents` and the
delete button in another. Below `sm` those wrapper divs are real flex
containers (the row becomes a stacked card: name on top, meta+status
below, delete button right-aligned). At `sm` and above, `display: contents`
removes the wrapper from the layout tree entirely, so its children become
direct grid children and land in the original 5-column grid exactly as
before.

**Lesson:** `display: contents` combined with Tailwind's responsive
variants (`sm:contents`) is a clean way to make one piece of markup serve
two structurally different layouts (stacked card vs. grid row) without a
duplicated conditional render — worth reaching for again anywhere else a
fixed-column table needs a mobile fallback.
