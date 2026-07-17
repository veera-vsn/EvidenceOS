# Phase 12 — Application-layer encryption

## What we built

A second, independent encryption layer on top of Supabase's existing
disk-level encryption at rest, covering the two columns that hold raw
customer document content: `document_text.content` and
`extraction_results.extracted_value`. If someone ever obtains raw
database read access without also holding this application's encryption
key, they see ciphertext, not contract text.

- **Algorithm:** AES-256-GCM (authenticated encryption — tamper-evident,
  not just confidentiality). Backend: `app/core/encryption.py`, using the
  `cryptography` package (already a transitive dependency, so this added
  no new package). Frontend decrypt-only counterpart:
  `apps/web/src/lib/crypto/document-encryption.ts`, using Node's built-in
  `crypto` module.
- **Key:** a single shared 256-bit key (`DOCUMENT_ENCRYPTION_KEY`, base64),
  set identically in both apps' env. This is the deliberate trade-off
  documented below and in both modules' docstrings.
- **Wire format:** `"enc:v1:" + base64(nonce(12 bytes) || ciphertext ||
  tag(16 bytes))`. The version prefix lets `decrypt_text()` distinguish
  encrypted values from historical plaintext rows written before this
  phase and return them unchanged rather than raising — same "old rows in
  a new shape are expected, not an error" precedent as
  `Phase_9_Full_RoI_Stage1/CHALLENGES.md` C5.

## Why a shared secret, not KMS

The textbook-correct design is envelope encryption via a KMS (AWS KMS,
given the backend already runs in `eu-central-1`): the master key never
leaves the KMS, the app only ever handles short-lived generated data
keys, and every decrypt is audit-logged. That was the original plan.

It wasn't built that way here because of one architectural fact
discovered while scoping the work: the Review and Pipeline pages read
`extraction_results.extracted_value` **directly from Supabase in Next.js
Server Components**, not through the FastAPI backend. There is no
backend round trip in that read path for a KMS-gated decrypt to sit
behind. Making that work with KMS would mean either giving Vercel its own
AWS IAM credentials (real operational complexity: a new credential to
rotate, an extra cross-cloud trust relationship, for a pre-revenue
product) or refactoring the Review/Pipeline pages to fetch decrypted
values through a new backend API endpoint instead of querying Supabase
directly — a bigger, riskier change than "add encryption" on its own,
and out of scope for one pass.

The shared-secret design is the pragmatic middle ground: it still raises
the bar against the most likely threat at this stage (a leaked read-only
DB credential, or a misconfigured RLS policy exposing rows to the wrong
workspace) without either of those costs. It's disclosed as a known
limitation in `Project_Docs/Legal/PRIVACY_POLICY.md` and
`DATA_HANDLING_AGREEMENT.md` rather than oversold as KMS-equivalent.
Migrating to real envelope encryption is the natural next step once a
paying customer's security review asks for it specifically.

## Scope: which fields, and why not more

Encrypted: `document_text.content` (the full OCR'd document text) and
`extraction_results.extracted_value` (the actual extracted field values)
— the two columns that are, or are derived directly from, a customer's
uploaded document.

Deliberately **not** encrypted in this pass: `field_reviews.edited_value`
(a reviewer's corrected value, arguably just as sensitive as the original
extraction). Left out to keep this change's blast radius bounded to the
two columns already scoped and tested end-to-end — encrypting reviews
next is a natural, small follow-up, not a gap that was missed.

## Read-path audit

Before writing any code, every place that reads `extraction_results` or
`document_text` was enumerated (both apps), because encrypting a column
silently breaks any reader that doesn't know to decrypt it:

- **Backend:** `revalidate.py` (re-validation after a review edit) and
  `export.py` (the actual xBRL-CSV export builder) both read
  `extracted_value` back from the DB. Both updated.
- **Frontend:** `review/[documentId]/page.tsx` and `pipeline/page.tsx`
  both read `extracted_value` directly via Supabase in Server Components.
  Both updated. `document_text.content` turned out to have **no current
  reader anywhere** — it's write-only today (stored for future
  re-extraction/RAG use), which meant encrypting it was risk-free for
  this pass.

The `export.py` read path was not on the original list of "known
readers" going in — it surfaced only from grepping the whole backend for
`extracted_value`, not from memory of the codebase. See
`CHALLENGES.md` C1 for what that would have shipped if missed.

## Verification

- 8 new unit tests (`tests/test_encryption.py`): round trip, Unicode/
  punctuation preservation, `None` passthrough, non-deterministic
  ciphertext (same plaintext encrypts differently each call), legacy-
  plaintext passthrough, tamper detection (`InvalidTag`), wrong-key
  rejection. Full suite: 85/85 passing, `ruff` clean, `tsc --noEmit`
  clean.
- Real end-to-end run against live Supabase + OpenAI using a new
  synthetic test document (`tests/fixtures/nimbus_cloud_msa_v3.pdf`,
  generated by `tests/fixtures/generate_demo_contract.py`) — see
  `CHALLENGES.md` C2 for the ligature-corruption bug that first run
  caught in the fixture generator itself, and C3 for a real,
  pre-existing validator finding it surfaced along the way.
- Confirmed: `document_text.content` and every non-null
  `extraction_results.extracted_value` row are ciphertext at rest;
  decrypted values exactly match the source document; validation runs
  correctly against decrypted values; re-running the pipeline on the
  same document version still produces exactly 61 rows, not 122 — the
  delete-then-insert fix from Phase 9/11 still holds with encryption in
  the write path.
