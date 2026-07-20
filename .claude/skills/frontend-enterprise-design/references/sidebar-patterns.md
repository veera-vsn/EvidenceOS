# Sidebar patterns

Three distinct sidebar contexts show up in enterprise/SaaS products, and they should NOT use the same pattern — a blog's content sidebar, a dashboard's app-navigation sidebar, and a listing page's filter sidebar all solve different problems.

## Content sidebar (blog, docs, long-form articles)

This is the pattern for a blog reading experience: the sidebar supports the article without competing with it.

**Layout**
- Left-aligned, fixed width around 280-320px (300px is a reasonable default), sitting beside a wider content column (the article should still be the visually dominant element — sidebar width should read as roughly a third of the content column or less on desktop).
- Collapses out of the layout below your content breakpoint (typically ~1024px) — see Mobile below.

**Sticky positioning**
- `position: sticky; top: <header height + a bit of breathing room, e.g. 24px>;` on the sidebar's own container, with `align-self: start` if it's a grid/flex item (otherwise a sticky child can stretch to its parent's full height and never actually "stick" visibly).
- Cap sidebar height so it doesn't outgrow the viewport with nothing to scroll: `max-height: calc(100vh - <top offset> - <bottom margin>); overflow-y: auto;` if the sidebar's own content (long category list, many tags) could exceed one screen.

**Visual hierarchy — order matters, top to bottom**
1. Search (if the blog has enough content to search) — a floating/bordered input, not a bare `<input>`
2. Newsletter signup or other primary conversion action — this is the highest-value ask, put it where it's actually seen
3. Latest/related posts (3-5 items, title + date, no heavy imagery)
4. Categories — collapsible if there are more than ~6 (see Progressive disclosure below)
5. Author bio / social links — a compact card, not a huge photo block
6. Tag cloud, archive-by-month, or anything else low-priority — bottom, or omit if it's not pulling weight

**Progressive disclosure**
- Category lists past ~6 items become a collapsible tree/accordion (`<details>`/`<summary>` is a perfectly good zero-JS implementation for this) rather than a flat wall of links. Show the top few categories expanded by default; collapse the long tail.
- Don't make the sidebar itself collapsible/toggleable on desktop — that adds a click for no benefit when there's room for it. Progressive disclosure is about *content within* the sidebar, not the sidebar's own visibility.

**Actionable widgets**
- Newsletter input: label it by outcome ("Get new articles by email"), not mechanism ("Subscribe to our mailing list"). High contrast button, single field (email only) — every extra field kills conversion.
- Author card: name, one-line role/credibility statement, 2-3 social/contact icons. No bio paragraph in the sidebar — that belongs on an author page if one exists.

**Mobile (below the content breakpoint)**
Do not just stack the full sidebar below the article — that buries genuinely useful navigation under a full article's worth of scrolling and makes search/categories nearly unreachable. Pick one:
- A horizontal, scrollable pill row for categories placed above the article (a "pill-scroll"), with search accessible via a single icon-button that expands a floating search field.
- A collapsed "Browse & search" bar above the article that expands into a bottom sheet/drawer on tap, containing the same content the desktop sidebar has (search, categories, latest posts), dismissible by tapping outside or a close control.
Either way: the newsletter signup usually still deserves its own placement (e.g., inline after the 2nd-3rd paragraph of the article, or as a footer block) rather than being buried inside a collapsed drawer, since it's the highest-conversion element.

## App navigation sidebar (dashboard/admin)

Different job: this is the primary means of moving between the product's sections, present on every authenticated page.

- Fixed width (200-260px is typical), full viewport height, not sticky-on-scroll in the content sense — it simply doesn't scroll with the page; only its own content area scrolls if the nav list is long.
- Current section always has a persistent, high-contrast active state (background fill or accent-colored indicator bar, not just a color change on text alone — see the accessibility note about color-alone signaling).
- Collapses to an icon-only rail (not a hidden drawer) on medium viewports if screen real estate is at a premium and the product is dense enough to want it; collapses to a hidden, hamburger-triggered off-canvas drawer on mobile — this is the one sidebar context where hide-on-mobile-behind-a-toggle is the right call, since navigation is needed occasionally, not continuously, once the user is on a page.
- Keep it flat where possible. If sections need grouping, use unobtrusive group labels (small-caps, muted color) rather than nested collapsible trees — an app nav that requires expand-and-search to find a page you visit daily is worse than a slightly longer flat list.

## Filter sidebar (search/listing pages)

Different job again: refining a result set, not navigating or reading.

- Sticky like the content sidebar, but typically narrower (240-280px) and denser — checkboxes, ranges, and toggles, not prose.
- Each filter group gets its own disclosure (open by default for the 2-3 most commonly used filters, collapsed for the rest) — this is where accordion-style progressive disclosure earns its keep the most, since filter panels grow unbounded as a product adds facets.
- Always show an active-filter summary (chips with an × to remove) near the top of the results, not just inside the sidebar — users scan results before they scan the sidebar that produced them.
- On mobile, this becomes a "Filters" button that opens a full-screen or bottom-sheet overlay, with a persistent "Show N results" primary action pinned to the bottom of that overlay so the user always knows the filter's effect without leaving the overlay.
