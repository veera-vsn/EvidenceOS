# Phase 2 — Worker & Trigger Walkthrough

---

## `ocr_worker.py` — `run_ocr_for_pipeline`

```python
def run_ocr_for_pipeline(run_id: str) -> None:
```

A plain synchronous function, not async. FastAPI's `BackgroundTasks` runs it
in a thread pool, so blocking I/O (Supabase SDK, file download) is safe.

### Why synchronous?

The Supabase Python SDK (`supabase-py`) is synchronous. Wrapping every call
in `asyncio.to_thread` would add complexity with no benefit for a single
background task. Async is valuable when you need to multiplex many concurrent
I/O waits; a sequential per-document loop doesn't need it.

### Service-role client

```python
client = get_service_client()
```

The worker uses the service-role key (bypasses RLS) because:
1. It writes to `document_text` — authenticated users can only SELECT.
2. It updates `pipeline_run_documents` and `pipeline_runs` — these also
   have write policies restricted to workspace members, but the worker is
   not acting as any specific user.
3. Storage download of private buckets requires either a signed URL or
   the service-role key.

### Error handling

```python
try:
    …
except Exception as exc:
    failed_count += 1
    doc_log.error("ocr_stage_failed", error=str(exc))
    client.table("pipeline_run_documents").update({"ocr_status": "failed"})…
```

Errors per document are caught individually — one failed document does not
abort the whole run. The run status becomes `'failed'` only if ALL documents
fail. If some succeed and some fail, the run status is `'completed'` (partial
success) so the user can see which documents need attention.

### Storage download

```python
download_resp = client.storage.from_("documents").download(storage_path)
file_bytes: bytes = download_resp
```

`supabase-py`'s `storage.download()` returns raw bytes. The storage path
is read from the `document_versions` row — the same path the browser wrote
to during Phase 1 upload.

---

## `router.py` — trigger endpoint

```python
@router.post("/runs/{run_id}/trigger", status_code=202)
async def trigger_pipeline_run(run_id: str, background_tasks: BackgroundTasks):
```

**202 Accepted** is the correct HTTP status for "I've acknowledged your
request and will process it asynchronously." 200 would imply the work is done.

### Validation before enqueuing

```python
resp = client.table("pipeline_runs").select("id, status").eq("id", run_id).single().execute()
if not resp.data:
    raise HTTPException(status_code=404, …)
if current_status != "queued":
    raise HTTPException(status_code=409, …)
```

409 Conflict is returned if the run is already `running` or `completed`.
This prevents double-processing if the trigger endpoint is called twice
(e.g. network retry).

---

## Next.js wiring — `actions.ts`

```ts
const triggerRes = await fetch(
  `${env.API_BASE_URL}/pipeline/runs/${run.id}/trigger`,
  { method: "POST" },
);
if (!triggerRes.ok) {
  console.error("Pipeline trigger failed:", await triggerRes.text());
}
```

Fire-and-forget pattern: the Server Action does not `await` a result from
the worker — only that the trigger endpoint acknowledged the request (202).
Errors are logged server-side but don't block the user or fail the action.

`env.API_BASE_URL` is `http://localhost:8000` in local dev (from `.env.local`).
In production this would be the internal URL of the FastAPI service.

---

## Interview Q&A

**Q: What would happen if the same run_id is triggered twice simultaneously?**

A: The second call would get a 409 Conflict because the first worker already
changed the status from `queued` to `running`. The validation check
`status != 'queued'` acts as a soft lock. For a stricter guarantee we would
use `SELECT … FOR UPDATE` (pessimistic lock) before the status check.

**Q: How would you make the pipeline status update in real-time in the UI
without polling?**

A: Supabase Realtime — subscribe to changes on `pipeline_run_documents` for
the current run_id. The browser receives a WebSocket event each time the
worker updates `ocr_status`. No polling needed. This is straightforward to
add in Phase 2.5: replace `router.refresh()` in the pipeline page with a
Supabase channel subscription.

**Q: Why store the extracted text in Postgres rather than object storage?**

A: For Phase 2–3, text is small enough for Postgres (typical contract: < 1MB).
Storing it in Postgres means we can query it with SQL (full-text search,
`LIKE`, substring match) without a separate API call. For Phase 5 RAG, we
will also chunk the text and store vector embeddings in pgvector — keeping
everything in Postgres avoids a separate vector database.
