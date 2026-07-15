# UI/UX redesign prompts — one per page

*Researched: 2026-07-15. Grounded in the actual current codebase (every
page, component, and data shape quoted below is real, not invented) and
live inspection of Vanta and Drata's product marketing pages — the two
competitors `COMPETITORS.md` explicitly says EvidenceOS's UX needs to
match. Companion to `COMPETITORS.md` and `GO_TO_MARKET_CHANNELS.md`.*

## How to use this doc

1. Paste **Section 1 (Design System Brief)** into your design tool first
   — either as the first message of a fresh conversation per page, or as
   persistent project context if the tool supports it. It sets the brand
   direction every page prompt below assumes.
2. Paste one page's prompt (Sections 3–11) per design request. Each is
   self-contained — the design tool won't have this conversation's
   context, so each prompt restates what that page actually does and
   shows.
3. Bring the resulting code/mockups back here. I'll adapt them into the
   real Next.js + Tailwind v4 codebase rather than replace working logic
   — the data-fetching, Server Actions, and RLS-backed queries underneath
   every page stay as-is; only the presentation layer changes.

---

## 1. Design system brief (paste first, every time)

```
I'm redesigning the UI for EvidenceOS, a B2B SaaS product that helps
EU financial firms (payment institutions, e-money institutions,
mid-sized banks, insurers, fintechs — 50-1000 employees) complete a
mandatory EU regulatory filing called the DORA Register of Information.
A compliance analyst uploads ICT vendor contracts, AI extracts
structured fields, deterministic rules validate them, a human reviews
and approves every value, then exports a draft filing.

AUDIENCE AND TONE
The user is a compliance/regulatory-reporting professional, not a
developer or a consumer. They need to trust this tool with a regulatory
filing that carries real legal accountability. The tone should read as
precise, calm, and audit-grade — closer to how a well-designed financial
terminal or an accountant's tool feels than how a consumer productivity
app feels. Avoid: playful illustrations, bouncy animation, marketing-site
gradients, anything that feels "fun." Every visual decision should answer
"does this make the data more trustworthy and scannable," not "does this
look modern."

COMPETITIVE CONTEXT (for direction, not to copy)
Two competitors set the UX bar in adjacent markets: Vanta (light theme,
lavender/purple accent, serif display headlines, soft rounded cards,
circular/linear progress indicators, colour-coded status pills, AI chat
panel with suggested-action chips) and Drata (dark theme, blue accent,
thin-line technical iconography, bold sans headlines, module-grid
layout). Both lean toward consumer-SaaS playfulness that undersells the
regulatory seriousness of what EvidenceOS does. Take their STRUCTURAL
lessons — clear status colour language, well-organised data density,
visible trust/freshness signals, confident typographic hierarchy — but
land somewhere more restrained and precise than either: think less
"trust platform marketing site," more "the software a Big 4 auditor
would actually respect."

CURRENT STATE (what exists today, to evolve not discard)
- Automatic light/dark mode driven by OS preference (prefers-color-scheme),
  no manual toggle. Both themes must work.
- A tiny, currently underused semantic colour set: success (green),
  warning (amber), danger (red), plus foreground/background. No accent
  brand colour is actually in use yet — pick one deliberately as part of
  this redesign (a considered, non-generic choice — not the purple every
  compliance SaaS uses, not a default blue).
- Text hierarchy today is done entirely via opacity steps on one
  foreground colour (100% down to 25%) rather than a grey palette or
  named tokens. Fine to keep or evolve, your call.
- No drop shadows anywhere currently — elevation is done via border +
  faint background tint. You can introduce subtle shadows if it serves
  the "trustworthy, precise" goal, but don't go heavy/glossy.
- Typography: Geist Sans + Geist Mono (mono reserved for IDs/codes).
  Fine to propose a different pairing if you have a strong reason,
  especially for headline display type.

TECHNICAL CONSTRAINTS (so the output is actually buildable)
- Next.js 16 (App Router) + React 19 + Tailwind CSS v4 (CSS-first config,
  tokens defined via @theme in globals.css, not a JS config file).
- No component library is installed yet (no shadcn/ui, no Radix, no MUI).
  You may design assuming shadcn/ui-style primitives ARE available if it
  meaningfully improves the design system (this codebase's own CSS file
  has a comment flagging shadcn/ui as "planned when we have visual
  identity" — this redesign is that moment) — just say explicitly which
  primitives you're assuming.
- Icons: currently hand-authored inline SVG only, no icon library. Lucide
  or Radix Icons would be a reasonable, lightweight addition if needed —
  flag if you use one.
- Data density matters: several screens (Pipeline, Review) show 13
  structured fields per document with a value, a confidence score, and
  multiple rule-validation badges each — the design needs to hold up at
  that density, not just in a hero screenshot with 3 items.
- Every screen must have a real empty state and a real loading/pending
  state, not just the happy path with data.
```

---

## 2. Design direction — my recommendation, stated plainly

Don't chase Vanta's warmth or Drata's dark-tech mood — both are built for
security engineers and DevOps buyers who respond to "modern startup"
energy. EvidenceOS's buyer is a compliance officer whose job is to be
skeptical of things that look too slick. The redesign should feel more
like: **a well-built financial data terminal that happens to be
beautiful**, not a trust-platform marketing site. Concretely: pick one
serious, deliberate accent colour (not purple, not generic blue — maybe
a deep teal, ink-navy, or forest green that reads "regulatory/financial"
without being a cliché), keep density high and legible rather than
airy, and spend the visual budget on making *status and confidence*
instantly scannable (this is a product where the whole value
proposition is "you can trust this number") rather than on decorative
polish.

---

## 3. Landing page (`/`)

```
Design a B2B SaaS marketing landing page for EvidenceOS.

WHAT THIS PAGE DOES TODAY
Single hero section: a small uppercase "EVIDENCEOS" kicker, a large
headline ("AI-powered DORA Register of Information copilot"), a
sub-headline explaining the pipeline (Upload -> Extract -> Validate ->
Export, human-approved), a live "System status" card showing whether the
backend API is reachable, and a muted footer note. That's currently the
entire page — no feature sections, no pricing, no social proof, no
screenshots.

WHAT IT NEEDS TO DO
This is a pre-launch/design-partner-stage product (no paying customers
yet), so the page's job is to make a compliance officer who lands here
from a cold outreach email or LinkedIn immediately understand: (1) what
regulatory problem this solves, (2) that it's evidence-first and
human-approved (not a black-box AI making filing decisions), (3) that
it's built specifically for DORA, not a generic compliance platform.

The single most important stat available: "93.5% of EU financial firms
failed the March 2026 DORA RoI quality checks." This should be load-bearing
in the hero, not buried.

SECTIONS TO DESIGN
1. Hero: kicker + headline + sub-headline + the 93.5% stat treated as a
   real visual element (not just a sentence) + a primary CTA ("Get a demo"
   or similar — no self-serve signup exists yet, this should route to a
   contact/waitlist action, not a live signup flow).
2. "The problem" section: contrast a compliance analyst manually
   reconciling hundreds of contracts in a spreadsheet against the DORA
   RoI's 116 automated quality checks that spreadsheets can't satisfy.
3. "How it works" — a clear visual pipeline: Upload -> AI Extract ->
   Deterministic Validate -> Human Review -> Export. Make the "human
   review" step visually distinct/emphasised — this is the trust
   argument, not a throwaway step.
4. Trust/evidence section: the idea that every extracted field traces
   back to its exact source document and the reviewer who approved it.
5. Footer: minimal, EU/GDPR data-residency mention (all data stays in EU
   regions — this matters a lot to this specific buyer).

Design for a first-time visitor who has never heard of EvidenceOS and
has 15 seconds of attention. No pricing section yet (pricing isn't public
yet — a section could exist but should route to "talk to us" not a
self-serve price list).
```

---

## 4. Login page (`/login`)

```
Design a login page for EvidenceOS, a B2B compliance SaaS product (see
design system brief).

WHAT THIS PAGE DOES TODAY
A centered narrow card: kicker + "Sign in to continue" headline + one-line
description, email field, password field, primary submit button, a
success notice state ("check your inbox for a confirmation link" — shown
after signup redirects here), an error notice state, and a footer link to
the signup page.

REQUIREMENTS
- Keep it genuinely simple — this is a utility screen, not a place to
  spend a lot of visual budget. The goal is fast, trustworthy,
  frictionless sign-in, not a design showcase.
- Must clearly render three states: default (empty form), error (a red
  alert banner above the form with a specific error message), and a
  "check your email" success notice (green/success-toned, shown when
  arriving here right after signup).
- No "forgot password" flow exists yet in the product — don't design one
  in unless you flag it as a suggested addition (it's a real gap).
- No social/SSO login exists yet — email+password only for now.
- This page sits inside a centered auth layout shared with the signup
  page — design them as a visually consistent pair.
```

---

## 5. Signup page (`/signup`)

```
Design a signup page for EvidenceOS, a B2B compliance SaaS product (see
design system brief). Visually consistent with the login page — same
layout shell, same card treatment.

WHAT THIS PAGE DOES TODAY
Same shape as login: kicker + headline + description, email field,
password field (min 8 characters), submit button, error state, footer
link back to login. On success it redirects to login with a "check your
email" notice — Supabase sends a confirmation email before the account
is usable.

REQUIREMENTS
- Communicate the email-confirmation step is coming, so the user isn't
  confused when they don't land straight in the product ("we'll send you
  a confirmation link" as a small note near the submit button is enough
  — don't over-explain).
- No company-name or workspace-name field on this screen today —
  workspace creation happens as a separate step after first login (see
  the Dashboard page below). Don't invent extra fields; if you think
  collecting the company name at signup would be better UX, propose it
  as a flagged suggestion rather than silently redesigning the flow.
- Same three states as login: default, error, (this page doesn't have a
  success notice itself since success = redirect to login).
```

---

## 6. Dashboard / workspace list (`/dashboard`)

```
Design the post-login home screen for EvidenceOS, a B2B compliance SaaS
product (see design system brief).

WHAT THIS PAGE DOES TODAY
Two possible states depending on whether the signed-in user belongs to
any workspace yet:
1. HAS WORKSPACES: "Your workspaces" heading + one-line explainer ("each
   workspace is one organisation, fully isolated") + a list of workspace
   cards, each showing the workspace name, a machine-readable slug in
   monospace, and an "Open ->" affordance. Clicking opens that
   workspace's Documents page.
2. NO WORKSPACES YET (first-ever login): a "Create your first workspace"
   card instead — explains the user will become its owner, a single text
   input for the workspace/organisation name, and a submit button.

REQUIREMENTS
- Most real users will only ever see ONE workspace (their own company) —
  design the single-workspace case to feel clean and purposeful, not
  like an awkwardly empty list. The multi-workspace case matters for
  users who consult across several client organisations, but it's the
  less common path.
- The zero-workspace / first-time-setup state is the very first thing a
  brand-new user ever sees in the product after confirming their email —
  it should feel welcoming and low-friction, this is technically still
  "onboarding."
- No workspace logo/avatar/branding exists yet — text-only workspace
  identity for now.
```

---

## 7. Documents (`/dashboard/[workspace]/documents`)

```
Design the document repository page for EvidenceOS, a B2B compliance
SaaS product (see design system brief). This sits inside a persistent
workspace shell with a top nav (Documents / Pipeline / Review / Export)
— design this page's content area; note separately if you think the nav
itself needs a redesign (see Section 11).

WHAT THIS PAGE DOES TODAY
1. A drag-and-drop upload zone (dashed border, accepts PDF/DOCX/XLSX/CSV
   up to 50MB each) with per-file upload progress rows showing
   queued -> uploading -> uploaded/failed states.
2. Below that, a list of every document already uploaded to this
   workspace: name, file type, file size, an upload-status badge
   (uploaded/uploading/failed), and a delete action.
3. Empty state when no documents exist yet: a single muted sentence
   pointing at the upload zone above.

WHAT EACH DOCUMENT REPRESENTS
Each document is one ICT vendor contract (a cloud provider agreement, a
SaaS terms of service, a data processing addendum, etc.) that will later
be run through AI extraction to populate DORA regulatory fields. Users
may upload the same document again later as a new version (e.g. a
contract renewal) — versioning exists in the data model even though this
page currently only shows the latest version per document.

REQUIREMENTS
- The upload zone needs to feel effortless — this is the very first real
  action a new user takes in the product, day one.
- The document list needs to scale to realistic volumes: a mid-market
  firm easily has 50-300 ICT vendor contracts. Design for a list that
  might have hundreds of rows, not just three — consider whether a flat
  list is still right at that scale, or whether search/filter/sort
  becomes necessary (this product doesn't have search/filter built yet —
  flag it as a needed addition if your design assumes it exists).
- Failed uploads need a clearly actionable error state (why did it fail,
  what can the user do).
```

---

## 8. Pipeline (`/dashboard/[workspace]/pipeline`)

```
Design the processing-pipeline page for EvidenceOS, a B2B compliance
SaaS product (see design system brief). This is the most data-dense
screen in the product — treat information density and scannability as
the primary design problem, not decoration.

WHAT THIS PAGE DOES TODAY
1. "Start a new run": checkboxes to select one or more uploaded documents,
   a "Start pipeline run" button.
2. "Run history": every past processing run, most recent first, each
   showing: a short run ID, a timestamp, an overall status badge
   (queued/running/completed/failed), and — critically — a per-document
   STAGE GRID: for each document in that run, five pipeline stages (OCR,
   Extract, Normalise, Validate, Recommend) each rendered as a small
   status glyph (pending/running/completed/failed/skipped).
3. Below the stage grid, for documents that completed extraction: a grid
   of the 13 extracted DORA fields, each showing the field code (e.g.
   "b_01.01.0010"), the field's human label, the extracted value (or a
   "Not extracted" state), an AI confidence percentage, and one or more
   small validation-rule badges (e.g. "REQUIRED FIELD" in red if a
   mandatory field is missing, in green if satisfied).

THIS IS A TECHNICAL/AUDIT LOG SCREEN, NOT A CONSUMER DASHBOARD
Think of this the way an engineer thinks of a CI/CD pipeline history
page (e.g. GitHub Actions run history) crossed with a data-quality
report — it's dense, technical, and its users are comfortable with that
as long as it's well organised. Do not try to simplify away the stage
grid or the per-field detail; the density IS the value (full traceability
of what happened to every document).

REQUIREMENTS
- The 5-stage grid needs a clear, immediately scannable visual language
  for 5 states across potentially many documents at once — this is the
  single hardest layout problem on this page, spend real design effort
  here.
- Validation badges can stack (a field can fail multiple independent
  rules) — design for a field showing 0, 1, or 3+ badges without the
  layout breaking.
- A confidence score under ~50% should read as visually different from
  one at 95%+ — this is a place where subtle colour-coding earns real
  trust.
- This screen will often show many runs stacked vertically — consider
  whether older/superseded runs should collapse by default (this
  product doesn't have that today — flag as a suggested addition if your
  design assumes it).
```

---

## 9. Review — list (`/dashboard/[workspace]/review`)

```
Design the "documents ready for review" list page for EvidenceOS, a B2B
compliance SaaS product (see design system brief).

WHAT THIS PAGE DOES TODAY
A list of every document that has been validated at least once, showing:
document name, file type, when it was last validated, and a review-progress
badge ("N/13 reviewed") colour-coded neutral (0 reviewed) / amber
(partial) / green (all 13 reviewed). Clicking a row opens that document's
review workspace (Section 10). Documents not yet validated don't appear
here at all.

WHAT "REVIEW" MEANS IN THIS PRODUCT
This is the human-in-the-loop gate: a compliance analyst must personally
approve, correct, or reject every one of the 13 AI-extracted fields per
document before that document's data can appear in the final regulatory
export. This list is essentially "your queue of outstanding review work."

REQUIREMENTS
- Frame this genuinely as a work queue/inbox — the mental model should
  be close to "triage" (what needs my attention, ordered sensibly),
  not just a passive document list. Consider whether documents with 0%
  progress vs. documents 90% done should be visually prioritised
  differently (currently sorted only by most-recently-validated).
  This product doesn't have due dates or assignment to specific
  reviewers yet — flag if your design assumes either.
- The progress badge is the single most important piece of information
  on each row — it should be the fastest thing to scan across the whole
  list.
- Empty state: no documents have been validated yet, with a link back to
  the Pipeline page to run one.
```

---

## 10. Review — detail (`/dashboard/[workspace]/review/[documentId]`)

```
Design the per-document review workspace for EvidenceOS, a B2B
compliance SaaS product (see design system brief). This is the core
"human-in-the-loop" screen of the entire product — the most important
single page to get right.

WHAT THIS PAGE DOES TODAY
Header: document name, "N of 13 fields reviewed" + a progress bar.
Below that, the 13 DORA fields grouped into three sections matching the
official EU regulatory template structure (RT.01.01 Contractual
arrangements — 7 fields; RT.02.01 ICT third-party providers — 3 fields;
RT.03.01 Outsourced functions — 3 fields).

Each field is a full-width card showing:
- Field code (mono, muted) + human-readable label.
- A review-decision badge: "Pending review" (neutral), "Approved"
  (green, check icon), "Edited" (green, pencil icon — approved AND
  edited both mean "reviewer confirms this is correct," differentiated
  only by icon), or "Rejected" (red, x icon).
- The current value — either the AI-extracted value + a confidence
  percentage, an editable/edited replacement value with a "Corrected
  value" caption, or an italic "Not extracted" state.
- Validation-rule badges (same rule badges as the Pipeline page — e.g.
  "REQUIRED FIELD" failing in red if the value is missing).
- Three actions: Approve / Edit / Reject. Edit swaps the value for an
  inline text input with Save/Cancel. Reject reveals a required textarea
  ("why is this value wrong?") — a rejection cannot be submitted without
  a reason, and that reason becomes part of the permanent audit record.

REQUIREMENTS
- This screen needs to feel like a careful, deliberate review tool — the
  reviewer is making a decision with real regulatory/legal weight on
  every field, and the design should support that seriousness without
  slowing them down when a field is obviously correct (the common case
  should be a fast "approve" action, not friction).
- The three-state action pattern (Approve/Edit/Reject) is core product
  behaviour, not just a UI detail — a redesign should make the ACTIVE
  decision for each field unmistakable at a glance across a long
  scrolling page of 13 fields.
- Consider keyboard shortcuts for the common "approve and move to next
  field" flow — this doesn't exist today but would matter a lot for a
  reviewer working through many documents. Flag it as a suggested
  addition if you design for it.
- The rejection reason (a compliance/audit artifact) deserves more
  visual weight than a throwaway textarea — this text may be read later
  by an auditor or a national regulator.
```

---

## 11. Export (`/dashboard/[workspace]/export`)

```
Design the export/download page for EvidenceOS, a B2B compliance SaaS
product (see design system brief).

WHAT THIS PAGE DOES TODAY
A summary before download: a count of documents "ready to export" (every
one of their 13 fields has been reviewed) vs. "not yet ready," a download
button (produces a .zip: one CSV per regulatory template + an evidence
audit trail CSV + a plain-text disclaimer manifest), and a list of
not-yet-ready documents each with a specific reason ("not yet validated
— run it through Pipeline" or "8/13 fields reviewed — finish review")
linking back to where the user needs to go to unblock it.

IMPORTANT CONTEXT FOR THE DESIGN
This export is explicitly a structured DRAFT for the compliance team's
own review — not an automatic regulatory filing (the product never
auto-submits anything to a regulator; a human always does that final
step outside this tool). This disclaimer is a real legal/trust point,
not filler text — it should be visible, not buried in fine print, but
also shouldn't read as an apology or a weakness. Frame it as "this is
exactly what a careful compliance tool should say," not "sorry, this
isn't finished."

REQUIREMENTS
- This is a satisfying "finish line" screen — after potentially reviewing
  dozens of documents across multiple sessions, this is where the work
  pays off. It should feel like a meaningful moment, not just another
  data table (without becoming celebratory/gamified — remember the tone:
  audit-grade, not consumer app).
- The "not ready yet" list is equally important — most visits to this
  page during an active review cycle will show a partial state, not a
  fully-ready one. Design that state as carefully as the success state.
- Consider surfacing what's actually IN the zip (the three template
  CSVs + the evidence trail) somewhere on this page, even just as a
  simple file listing — right now a user has to download and unzip to
  find out what they got.
```

---

## What this doc is NOT

- Not a finished spec — these are starting prompts. Expect to iterate
  with whatever design tool you use before the output is ready to bring
  back here.
- Not a decision to introduce a component library, a new accent colour,
  or shadows — those are framed as open decisions for the design pass to
  resolve, not settled here.
- Not covering the persistent workspace nav shell as its own prompt —
  it's referenced inside Section 1 and the page prompts above should
  each note if they assume a redesigned nav (e.g. a sidebar instead of
  the current top nav, now that there are four sections instead of two).
  If the nav genuinely needs its own dedicated redesign prompt, ask and
  I'll write one.
