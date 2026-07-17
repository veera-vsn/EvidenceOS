# Phase 12 (Encryption) — Challenges

---

## C1 — `export.py`'s read path was not on the original list of readers

**Symptom:** none observed in production — caught during the read-path
audit described in `01_overview.md`, before it could ship.

**Root cause:** `determine_export_eligibility()` in `export.py` builds
the `extracted` dict that ultimately becomes the actual xBRL-CSV export
content, reading `extraction_results.extracted_value` straight from a
Supabase query. It wasn't part of the mental list of "who reads this
column" going in — that list was built from memory of the Review and
Pipeline pages (the obviously UI-facing readers) and `revalidate.py` (the
obviously code-adjacent one). `export.py` was found only by grepping the
whole `apps/api/app` tree for `extracted_value` after wiring the writes,
as a deliberate verification step, not because it was expected to be
there.

**Fix:** added the same `decrypt_text()` call at the point `extracted` is
built.

**Lesson:** "encrypt a column" is a whole-codebase change disguised as a
two-line one. Enumerating readers from memory is not enough — grep for
the exact column name across both apps before considering the write side
done, the same way this project already treats "verify with a real
count/run, don't trust the written plan" as standard practice
(`Phase_4_Validation/CHALLENGES.md` C5, reused throughout the Full RoI
phases). Had this shipped unnoticed, every export would have silently
contained AES-GCM ciphertext instead of contract data — a correctness
bug that unit tests (which don't exercise `export.py`'s DB-touching
function) would not have caught, only a real export attempt would have.

---

## C2 — The PDF test fixture's own generator corrupted "ff"/"ffi" sequences

**Symptom:** building the demo contract PDF via PyMuPDF's `fitz.Story`
HTML/CSS engine, then round-tripping it through the app's own
`extract()` function, showed `"Difficult" in text` returning `False` —
along with `"Effective"`, `"office"`, `"affiliate"`, `"sufficient"`,
`"staff"`. 24 non-ASCII characters in the U+FB00-FB06 range were present
in the extracted text.

**Root cause:** MuPDF's `Story` text-shaping pipeline applies standard
OpenType ligature substitution (`ff` → U+FB00, `ffi` → U+FB03, etc.)
during layout, regardless of the CSS font-family requested — confirmed
by testing five different `font-family` values (Helvetica, generic
sans-serif, Arial, Times, Courier); all but the monospace one produced
the same 6 ligature characters on a fixed test sentence. This isn't a
cosmetic issue: it corrupts the PDF's embedded text layer, not just its
rendered appearance, and "Difficult" is not decorative prose here — it's
one of the four literal EBA-controlled-vocabulary values for
`b_07.01.0090`, and "...difficulties in migrating or reintegrating" is
part of the exact enum text for `b_07.01.0060`. A ligature-corrupted
version of either would have been unrecoverable from the text layer
before the extraction LLM ever saw it.

**Fix:** switched the fixture generator from `fitz.Story` (HTML/CSS,
full text shaping) to PyMuPDF's lower-level `page.insert_textbox()` API,
which places glyphs without a shaping pass — confirmed via the same
test sentence: 0 ligature characters, `"Difficult" in text` is `True`.
Rewriting the generator this way meant handling pagination, headings, and
spacing manually instead of getting it from the HTML/CSS engine, a real
cost, but the tests exist precisely to catch content-fidelity problems
like this one before they reach a document meant to be a reliable
canonical fixture.

**Lesson:** never trust a generated test document's *appearance*
(`doc.save()` succeeding, or a rendered screenshot looking fine) as proof
its *extracted text layer* is correct — the two can silently diverge.
Round-tripping the fixture through the actual extraction function it's
meant to be tested with (`app.pipeline.extractor.extract()`, not just
"does the PDF library not error") is what caught this, and is worth doing
for any future fixture, not just this one.

---

## C3 — A real, pre-existing validator finding surfaced by the new fixture (not fixed here)

**Symptom:** `b_02.01.0030` ("Overarching contractual arrangement
reference number") and `b_05.01.0060` ("Name of the ICT third-party
service provider in Latin alphabet") both produced a **contradictory
pair of validation results** on the same field in the same run:
`CONDITIONAL_REQUIRED` correctly resolved to `skipped` / "Condition not
met" (both fields are genuinely optional for this document — a
standalone arrangement with no overarching reference, and a provider
name already in Latin script), while `COMPLETENESS_GROUP` fired anyway
and reported `fail` / "A related field is filled in, so this field is
also required" — for the same field, in the same validation run.

**Root cause (best current understanding, not fully root-caused):** the
`_COMPLETENESS_GROUPS` rule appears to treat these two fields as
unconditionally required whenever any sibling in their group is filled,
while EBA's real rule for both is genuinely conditional (only required
when the arrangement is a subsequent/associated one, or when the
provider's legal name isn't already in Latin script, respectively) — the
same distinction `_CONDITIONAL_PAIRS` already exists to express, and
apparently does express correctly for at least one of these two fields,
since `CONDITIONAL_REQUIRED` reached the right answer independently.
Nothing in this codebase's synthetic test data before this phase happened
to exercise "a real standalone arrangement with every other B_02.01
field filled in" — the AWS test document used throughout Phase 9-11 has
much lower fill-rate and likely never triggered this specific
completeness-group condition.

**Fix:** none applied. This is a validator design/rule-precision
question, not an encryption question, and fixing it correctly means
understanding whether every field in `_COMPLETENESS_GROUPS` needs the
same conditional treatment or just these two — a task with its own scope,
deserving its own pass rather than a rushed change riding on this one.

**Lesson:** a synthetic test document written to be *complete* (every
field filled in a realistic way) is a different, and complementary, kind
of test pressure than a real vendor contract with a naturally low
fill-rate — it exercises rule interactions ("what happens when a whole
completeness group is genuinely, correctly satisfied except one
conditionally-optional field") that sparse real documents never reach.
Worth treating `nimbus_cloud_msa_v3.pdf` as a standing regression fixture
for exactly this reason, not just a one-off pipeline smoke test.

---

## C4 — `DOCUMENT_ENCRYPTION_KEY` was never added to Vercel, so Pipeline and Review 500'd in production

**Symptom:** `/dashboard/[workspaceSlug]/pipeline` and the Review page
both threw `Error: Missing required environment variable:
DOCUMENT_ENCRYPTION_KEY` in production (caught via Vercel's runtime error
grouping, not a bug report) — every visit 500'd, since both pages call
`decryptText()` unconditionally on page load.

**Root cause:** this phase's commit added `DOCUMENT_ENCRYPTION_KEY` to
`apps/web/.env.local` and `apps/api/.env` for local development and
testing, but the Vercel dashboard's Production and Preview environment
variable sets were never updated — the exact same failure shape as
`Phase_7_Deployment/CHALLENGES.md` C7 (env var added locally, forgotten
per-environment on Vercel), just recurring for a newer var. Confirmed via
`get_logs`/`list_tables` against the live Supabase project that the
Pipeline page's own queries were all returning 200 — the bug was purely
in the decrypt step after a successful fetch, not the data layer.

**Fix:** `vercel env add DOCUMENT_ENCRYPTION_KEY production` and
`... preview`, using the same key value already in `apps/api/.env` (it
has to be the *same* key the backend used to encrypt the existing rows,
or decryption fails with an auth-tag mismatch — not a new key), then
redeployed production. Confirmed via `get_runtime_errors` that no new
occurrences appeared afterward.

**Lesson:** this is the second time this exact failure mode has hit this
project (see Phase 7 C7) — a env var landing in a local `.env` file is
not evidence it's anywhere else. Any change that adds a new required env
var should end with an explicit "is this set in every deploy target"
check, not just a local smoke test. See
`Phase_7_Deployment/CHALLENGES.md` C9 for the second half of this
incident — fixing this side triggered a related, worse outage on the
EC2 backend.
