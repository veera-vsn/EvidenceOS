# Phase 2 — OCR Worker

## What we built

Phase 2 brings the first real pipeline stage to life: text extraction from
uploaded compliance documents. When a user clicks "Start pipeline run", the
system now actually reads the document and stores the extracted text.

### New components

| Component | Location | Role |
|---|---|---|
| `extractor.py` | `apps/api/app/pipeline/` | Pure functions — one per file type — that convert raw bytes to plain text. |
| `ocr_worker.py` | `apps/api/app/pipeline/` | Orchestrates a full run: downloads each file, extracts text, writes to DB, advances stage status. |
| `router.py` | `apps/api/app/pipeline/` | FastAPI router — `POST /pipeline/runs/{run_id}/trigger` accepts a run ID and starts the worker as a BackgroundTask. |
| `document_text` | Supabase DB (migration 0006) | Stores extracted plain text per document version — one row per version, unique constraint. |

### Flow

```
User clicks "Start run"
    │
    ▼
startPipelineRun (Next.js Server Action)
    ├─ INSERT pipeline_runs (status: queued)
    ├─ INSERT pipeline_run_documents (ocr_status: pending × N docs)
    └─ POST /pipeline/runs/{id}/trigger → FastAPI (fire-and-forget)
                │
                ▼
        trigger_pipeline_run (FastAPI endpoint)
            ├─ Validates run exists + is queued
            └─ Enqueues run_ocr_for_pipeline as BackgroundTask
                        │
                        ▼
                run_ocr_for_pipeline (Python worker)
                    ├─ UPDATE pipeline_runs status → running
                    ├─ For each document_version:
                    │   ├─ UPDATE ocr_status → running
                    │   ├─ Storage.download(storage_path)
                    │   ├─ extract(file_type, bytes) → text
                    │   ├─ UPSERT document_text
                    │   └─ UPDATE ocr_status → completed | failed
                    └─ UPDATE pipeline_runs status → completed | failed
```

### File types supported

| Type | Library | Notes |
|---|---|---|
| PDF | PyMuPDF (`fitz`) | Reads text layer. Scanned PDFs return empty text (future: Tesseract). |
| DOCX | python-docx | Reads paragraphs in order. Tables handled in Phase 3. |
| XLSX | openpyxl | All sheets, all rows, cell values cast to strings. |
| CSV | stdlib `csv` | UTF-8 first, latin-1 fallback. |

---

## Why Python for this, not TypeScript?

Text extraction libraries (PyMuPDF, python-docx, openpyxl) are Python-native
and battle-tested. The JavaScript equivalents (pdf-parse, mammoth, xlsx) are
less capable and less maintained. For a compliance use-case where extraction
accuracy matters, Python is the right runtime. TypeScript stays as the thin
glue between UI and backend.

---

## Interview Q&A

**Q: Why use FastAPI BackgroundTasks instead of a dedicated job queue?**

A: BackgroundTasks are the simplest correct solution for an MVP. The task
runs in the same process as the API server, so no additional infrastructure
is needed. The trade-off: if the server restarts mid-run, the background task
is lost and the run stays in `running` state. A production version would use
pgmq or BullMQ. For now, the `queued` state check at the trigger endpoint
means a restart is recoverable — just re-trigger the run.

**Q: How does the Next.js Server Action call FastAPI without leaking secrets?**

A: The Server Action runs on the Node.js server (not in the browser), so it
can safely read `env.API_BASE_URL` (an internal service URL). The call to
`POST /pipeline/runs/{id}/trigger` never reaches the browser. The FastAPI
endpoint itself uses the service-role key from its own `.env` file.

**Q: What happens if the FastAPI server is down when the user starts a run?**

A: The pipeline_run row is created first (in `queued` state) before the
trigger call. The trigger failure is caught and logged but does not block the
user — the action returns success and the page refreshes showing the queued
run. A future poller or retry mechanism can pick up stale `queued` runs.
