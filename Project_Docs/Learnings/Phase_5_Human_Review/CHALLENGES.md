# Phase 5 — Challenges

## C1: An edited value disappeared from view immediately after saving it

**What happened:** End-to-end verification (not the test suite — this is
exactly the kind of bug tests don't catch) walked through editing a
missing required field, entering a correction, and saving. The badge
correctly flipped to "Edited" and the `REQUIRED_FIELD` validation badge
correctly flipped from fail to pass. But the field's value display still
read *"Not extracted"* — right next to a badge claiming it had been
corrected.

**Root cause:** The card's idle-state display read `field.extracted_value`
directly. `extraction_results.extracted_value` is never mutated by a
review — the correction lives entirely in `field_reviews.edited_value`, a
separate column in a separate table, by design (see `01_overview.md`'s
audit-trail decision). Nothing reconciled the two for display; the UI was
technically showing "the AI's original value," which for this field was
still `null`.

**Fix:** Added a computed `displayValue` in `field-review-card.tsx` that
prefers `review.edited_value` when `review.decision === "edited"`, falling
back to `field.extracted_value` otherwise, and a small "Corrected value"
caption in place of the confidence pip (confidence describes the AI's
extraction, not a human's correction, so showing a percentage next to a
reviewer-supplied value would have been actively misleading).

**Why it matters:** This shipped past `tsc --noEmit`, past every existing
lint rule, and there was no test to catch it because the bug was a UI
composition mistake, not a logic error either side of the API boundary
could unit-test — the Server Action correctly wrote `edited_value`, the
revalidate endpoint correctly used it, `validate_fields()` correctly
computed against it. Only the *display* forgot to look at it. This is the
same category as Phase 4's C5 (a UI filter/read path not updated to match
a new data source) — different mechanism, same root lesson.

**Interview lesson:** When a value can come from more than one source
(AI extraction vs human correction, in this case), decide once — in one
place — which source wins for display, and route every read through that
single computed value. Scattering `field.extracted_value` reads across a
component and hoping they all get updated together is exactly how this
kind of bug survives a full green test suite. The fix here is a two-line
`displayValue` computed once at the top of the component; the bug was
three separate call sites each independently deciding to read the wrong
field.

---

## C2: A stale background process kept answering requests with old code

**What happened:** After adding the new `POST
/pipeline/documents/{id}/revalidate` endpoint, a direct `curl` against it
returned `404 Not Found` even though the code was correct and `uvicorn
--reload`'s log showed no reload event for the new files. Restarting the
dev server didn't fix it either — the new instance also returned 404 on
the first attempt.

**Root cause:** `Stop-Process` against the old reloader's PID returned
successfully, but the OS took a moment to actually release the TCP
listener on port 8000. A `netstat`-equivalent check
(`Get-NetTCPConnection -LocalPort 8000`) showed **two** processes bound to
the same port simultaneously for a short window — the old reloader (which
had somehow survived the first kill attempt along with its child worker
process) and the newly started one. Requests were being non-deterministically
routed to whichever process's listener won, so the same `curl` command
could hit either the old code (404, route doesn't exist) or the new code
(200) depending on timing.

**Fix:** Checked `Get-NetTCPConnection -LocalPort 8000` explicitly rather
than trusting a single `curl` response or the absence of a
`Stop-Process` error, found the orphaned reloader and its child worker
process by PID, force-killed both, re-verified only one PID owned the
port, then re-verified the endpoint via `/openapi.json` (which lists every
registered route) rather than a single ad-hoc request.

**Why it matters:** A single successful health check is not proof a
background dev server is running the code you think it's running,
especially after a kill/restart cycle on Windows where process teardown
isn't always synchronous with the command that requested it. This is a
process-management lesson, not a product bug, but it directly delayed
verifying the real behaviour of the endpoint by making results look
flaky/random when the underlying code was actually correct the whole
time.

**Interview lesson:** When "it works" and "it doesn't work" alternate on
identical requests with no code change in between, suspect environment
state (duplicate processes, stale caches, multiple listeners) before
suspecting the code. `/openapi.json` — or any endpoint that enumerates
*everything currently registered* — is a more trustworthy check than a
single request/response pair, because it can't be answered inconsistently
by two different processes serving two different route tables.

---

## C3: Viewer-role gating was verified by code + role query, not a live second account

**What happened:** The verification plan called for confirming that a
`viewer`-role workspace member does not see the Approve/Edit/Reject
controls. No second test account existed in this workspace, and creating
one purely to exercise this one code path was judged disproportionate to
the risk being checked.

**What was actually verified instead:** The current test user's role was
queried directly (`owner`), confirming `getCurrentWorkspaceRole` +
`canReviewFields` correctly granted access for a real, non-mocked role
value read from the database — not just a value threaded through by hand
in a test. The `canReview && mode === "idle"` conditional that hides the
action row is a single, simple, type-checked expression, and the real
security boundary is the RLS `insert`/`update` policies (Phase 5's
migration), which were checked against Supabase's advisor tooling and
produced no new findings.

**Why this is a documented gap, not a silent skip:** RLS is what actually
stops a `viewer` from writing a review row even if the UI bug somehow
showed them the buttons — that part is verified. What's *not* directly
observed is the specific UI behaviour (buttons absent, not just
disabled-and-failing) for a real `viewer` session. Recorded here so a
future pass — or before this feature is treated as fully signed off for a
workspace that actually has viewer-role members — can close it with a
real second account.

**Interview lesson:** Not every item on a verification checklist is
equally cheap to execute for equal value gained. Spinning up a disposable
test identity to click through one conditional render is reasonable in
some contexts and wasteful in others; the judgment call is worth writing
down explicitly (what was checked instead, and why it's a reasonable
stand-in) rather than either silently skipping the item or performing it
regardless of cost.
