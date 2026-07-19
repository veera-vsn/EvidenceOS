# How EvidenceOS Works — App Summary & RAG Roadmap

## What the app does (one paragraph)

A compliance analyst uploads an ICT vendor contract (PDF, DOCX, or XLSX) into
their workspace. The file goes directly from the browser to Supabase Storage.
They click **Start Pipeline Run** — the Next.js frontend calls the FastAPI
backend, which returns a 202 Accepted immediately and runs two stages in the
background. Stage A (OCR) downloads the file and extracts plain text. Stage B
(Extraction) feeds that text to GPT-4o-mini, which returns a JSON object with
13 DORA RoI fields and confidence scores. Results are saved to the database and
displayed in a colour-coded grid. A human reviewer then sees exactly what the AI
found, what it missed, and — in later phases — what the validation rules flagged
as wrong.

---

## The full pipeline (all phases)

```
Phase 1  ✅  Upload → Supabase Storage + document_versions row
Phase 2  ✅  OCR → plain text in document_text table
Phase 3  ✅  AI extraction → 13 DORA fields in extraction_results table
Phase 4  ✅  Validation → 7 deterministic rule types, 19 checks/document (no LLM) — our 13-field subset of the regulator's full 116-check RoI validation
Phase 5  ✅  Human review UI → approve / edit / reject each field
Phase 6  ✅  xBRL-CSV export (draft) → structured RoI-shaped output, not a taxonomy-conformant filing
Phase 7  →   RAG + recommendations → deep extraction + "why this field is wrong"
```

---

## Stage A — OCR (Phase 2)

**Files:** `apps/api/app/pipeline/extractor.py`, `ocr_worker.py`

1. Worker downloads the binary file from Supabase Storage using the service-role
   client (bypasses RLS — the worker is a trusted internal process).
2. Dispatches to the correct handler based on `file_type`:
   - PDF → pdfplumber (`import pdfplumber`) — was PyMuPDF until 2026-07-19,
     swapped for an AGPL licensing concern; see extractor.py's docstring
     and `Project_Docs/AUDIT_2026-07-18.md`'s Dependency Audit.
   - DOCX → python-docx
   - XLSX → openpyxl
   - CSV → stdlib `csv`
3. Strips null bytes (`\x00`) — some PDF text extractors emit them for
   certain embedded fonts and PostgreSQL rejects them with error 22P05.
4. Upserts plain text + word count into `document_text`.
5. Marks `pipeline_run_documents.ocr_status = 'completed'`.

---

## Stage B — Field Extraction (Phase 3)

**Files:** `apps/api/app/pipeline/field_extractor.py`

1. Truncates text to 12,000 characters (≈3,000 tokens — keeps cost low).
2. Builds a prompt listing all 13 DORA fields with their ESMA field codes and
   extraction hints.
3. Calls GPT-4o-mini with:
   - `response_format={"type": "json_object"}` — hard JSON guarantee
   - `temperature=0` — fully deterministic
4. Parses the response, drops any hallucinated field codes, fills missing codes
   with `null / 0.0`.
5. Bulk-upserts 13 rows into `extraction_results` (idempotent on
   `document_version_id, field_code`).
6. Calls `Langfuse().flush()` so traces reach the dashboard before the
   background task exits.

---

## Where RAG fits (Phase 7)

### The problem RAG solves

The current single-pass approach sends the first 12,000 characters to the model.
For a 200-page contract, this misses fields buried on page 40 (e.g. the
termination notice clause, the data sensitivity schedule). Truncation is fast and
cheap but incomplete.

### How RAG works

**Retrieval-Augmented Generation** replaces the single-pass prompt with a
search-then-answer loop:

```
Full document text
      ↓
Split into overlapping chunks (~500 tokens each)
      ↓
Embed each chunk using an embedding model (e.g. text-embedding-3-small)
      ↓
Store embeddings in pgvector (Postgres extension, native in Supabase)
      ↓
At extraction time, for each DORA field:
  → Embed the field description as a query vector
  → Find the 3-5 most semantically similar chunks (cosine similarity)
  → Send only those chunks to GPT-4o-mini
      ↓
Merge results across all 13 fields
```

### Why pgvector (not a separate vector DB)

Supabase supports pgvector natively — vector similarity search runs inside the
same Postgres instance as our other tables. No additional infrastructure, no
extra cost tier, no cross-service latency. For our document volumes this is the
right choice. If we ever need to search across millions of chunks, we would
evaluate Pinecone or Weaviate.

### Where the code will live

All RAG logic stays in Python (`apps/api/app/pipeline/`):

```
apps/api/app/pipeline/
├── extractor.py          (Phase 2 — unchanged)
├── ocr_worker.py         (Phase 2 — unchanged)
├── field_extractor.py    (Phase 3 — single-pass, becomes the baseline)
├── embedder.py           (Phase 7 — chunk + embed document text)
├── retriever.py          (Phase 7 — cosine similarity search via pgvector)
└── rag_extractor.py      (Phase 7 — retrieval-augmented field extraction)
```

No TypeScript is involved in the RAG pipeline. TypeScript handles UI and
routing only.

### Cost comparison (estimated)

| Approach | Tokens per document | Cost per document |
|---|---|---|
| Single-pass (Phase 3) | ~3,500 | ~$0.001 |
| RAG per field (Phase 7) | ~500 × 13 fields | ~$0.005 |
| RAG with caching | ~500 × new fields only | ~$0.002 |

RAG costs ~5× more per document but covers the full contract. The Langfuse
baseline from Phase 3 is the comparison point for this experiment.

---

## Database schema (current)

```
workspaces
  └── documents
        └── document_versions
              ├── document_text          (OCR output)
              └── extraction_results     (per-field AI output)
        └── pipeline_runs
              └── pipeline_run_documents (links runs ↔ versions, tracks stage status)
```

All foreign keys cascade on delete. Deleting a workspace removes everything
inside it cleanly.

---

## Key numbers to remember

| Metric | Value |
|---|---|
| DORA fields we extract | 13 (from 3 ESMA ITS templates) |
| Our validation rule types (Phase 4) | 7, producing 19 checks/document over our 13 fields |
| Full regulatory RoI quality checks (EBA/ESMA/EIOPA, all fields, not just ours) | 116 — [source](https://www.eba.europa.eu/publications-and-media/press-releases/esas-dry-run-exercise-shows-goal-reporting-registers-information-under-digital-operational) |
| Text truncation limit | 12,000 characters |
| Cost per extraction (Phase 3) | ~$0.001 |
| Langfuse trace delay | 3–5 seconds (batching) |
| EU submission frequency | Annual + quarterly updates |
| 2024 EU-wide dry run: firms passing all 116 checks | 6.5% — [source](https://www.eba.europa.eu/publications-and-media/press-releases/esas-dry-run-exercise-shows-goal-reporting-registers-information-under-digital-operational) |
