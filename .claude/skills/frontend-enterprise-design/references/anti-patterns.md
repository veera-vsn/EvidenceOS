# Common accessibility/UX anti-patterns to catch

Concrete bugs to grep for and fix, found repeatedly in real codebases:

**Fake-disabled interactive elements.** A `<Link>` or `<a>` styled to look disabled via `aria-disabled` + `pointer-events-none` classes is still keyboard-focusable and, in some browsers/assistive tech combinations, still activatable — `pointer-events-none` only blocks mouse/touch, not keyboard `Enter`/`Space` activation of a focused link. If something should be unclickable, render a real `<button disabled>` (which is genuinely inert) instead of a style applied to a naturally-always-active element.

**Color-only status signaling.** A badge that's just "green pill" vs "red pill" with the same text, or a table row highlighted red with no other indicator, fails for colorblind users and anyone in a bright-sunlight/low-contrast viewing situation. Pair color with an icon, a text label, or a pattern.

**Placeholder-as-label.** `<input placeholder="Email">` with no `<label>` disappears the moment the user starts typing and isn't announced consistently by screen readers. Always pair with a real (visually-hidden if needed) `<label>`.

**Div-button.** `<div onClick={...}>` with no `role="button"`, `tabIndex`, or keyboard handler is invisible to keyboard and screen-reader users entirely. Use a real `<button>` unless there's a specific reason not to (and if there is, add the full ARIA + keyboard-handler trio, not just a click handler).

**Contrast checked only in the default state.** A token that passes WCAG AA at rest can fail on hover/pressed/disabled states if those states lighten or desaturate the color further. Check the actual rendered contrast in every interactive state, not just idle.

**Layout-shift on load.** Content that pops in without reserved space (images without dimensions, skeleton-less async content) causes visible jank and hurts Core Web Vitals (CLS). Reserve space with explicit dimensions or a skeleton matching the real layout's shape.

**Everything the same shade of grey.** Using one muted foreground color for timestamps, secondary labels, disabled states, and placeholder text alike collapses several different *meanings* into one visual signal, and often that one shade was picked without checking contrast at all (a frequent real-world source of WCAG AA failures — see this project's own `--fg-3` fix for a concrete example: a single grey token used everywhere for "de-emphasized text" turned out to fail 4.5:1 against both the light and dark backgrounds it was used on).
