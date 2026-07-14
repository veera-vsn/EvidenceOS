# Phase 3 — Challenges

## C1: Switched from Anthropic to OpenAI mid-build

**What happened:** We started Phase 3 wiring for `anthropic` SDK + Claude Haiku. The user then decided to use OpenAI: *"actually you know i want to use open AI."*

**Root cause:** No upfront alignment on which LLM provider to use for extraction.

**Fix:** Rewrote `field_extractor.py` to use `openai` SDK (`gpt-4o-mini`). Changed `extraction_method` default from `"claude-haiku"` to `"gpt-4o-mini"` in the `ExtractionField` dataclass. Updated `requirements.in` (removed `anthropic`, added `openai`).

**The 0007 migration** had `'claude-haiku'` as the default in the `extraction_method` column — we left the column default as a string rather than hard-coding the model name in SQL. The Python dataclass sets the actual value, so the SQL default is never used in practice.

**Interview lesson:** When the choice of LLM provider is not fixed, keep the extraction module thin and don't leak provider-specific names into schema defaults. The `extraction_method` column name (generic) is better than `anthropic_model` (specific).

---

## C2: Ruff lint failures on first pass

**What happened:** After writing `field_extractor.py`, `ruff check .` failed with three errors:
- `E501` — a long f-string line in the user prompt exceeded 88 chars.
- `RUF001` — used `–` (EN DASH, U+2013) in a hint string; Ruff flagged it as a confusable character.
- `RUF100` — `# noqa: BLE001` was added to a broad `except Exception` block, but `BLE001` is not in the `pyproject.toml` ruleset so the noqa comment was itself an error.

**Fixes:**
- E501: extracted `truncation_note` as a variable before the f-string.
- RUF001: replaced EN DASH (`–`) with hyphen-minus (`-`) in hint strings.
- RUF100: removed the `# noqa: BLE001` comment entirely; the broad except in `extract_fields` is intentional (we re-raise anyway) and `BLE001` is not enabled.

**Interview lesson:** Add `ruff check .` to the mental checklist before claiming a Python file is complete. It catches not just style issues but also lint rules you didn't know were enabled. In a team, this is enforced by pre-commit hooks.

---

## C3: `ocr_worker.py` called `extract_fields` without `document_version_id`

**What happened:** `field_extractor.py` accepts `document_version_id` as an optional parameter and passes it to Langfuse metadata so each trace is linkable back to the DB row. The initial wiring in `ocr_worker.py` omitted it:

```python
fields = extract_fields(extracted_text, doc_name)  # missing version_id
```

**Fix:** Updated the call to:

```python
fields = extract_fields(extracted_text, doc_name, document_version_id=version_id)
```

**Why it matters:** Without `document_version_id` in the Langfuse trace metadata, you cannot click from a trace in the dashboard to the corresponding DB row. Debugging a wrong extraction requires correlating by document name alone, which is ambiguous when the same document is processed multiple times.

**Interview lesson:** Observability metadata linkage is easy to add and hard to retrofit. When wiring LLM calls, always pass the primary key of the entity being processed as trace metadata from day one.

---

## C4: Langfuse EU region — not optional for this product

**What happened:** Langfuse has a US cloud (`cloud.langfuse.com`) and an EU cloud (`eu.cloud.langfuse.com`). The default in most tutorials is US.

**Fix:** `LANGFUSE_HOST=https://eu.cloud.langfuse.com` is set in both `.env` and `config.py` default. The `_build_langfuse_client()` function sets this env var before constructing the client.

**Why it matters:** DORA is an EU regulation. The documents being processed are ICT vendor contracts — potentially containing data subject information under GDPR. Sending trace data (which includes prompt content) to a US region without an adequacy decision or SCCs would be a compliance violation. EU region is the only correct choice.

**Interview lesson:** For any EU fintech product, data residency is a first-class constraint, not a checkbox at launch. Design storage and observability infrastructure for EU regions from day one.

---

## C5: requirements.txt lockfile diverges from requirements.in

**What happened:** After adding `openai` and `langfuse` to `requirements.in`, the `requirements.txt` lockfile was not regenerated. This means `pip install -r requirements.txt` on a fresh machine would not install the new packages.

**Fix:** Run `.venv/Scripts/pip install -r requirements.in && .venv/Scripts/pip freeze > requirements.txt` before committing Phase 3.

**Interview lesson:** Treat `requirements.in` as the source of truth (what you want) and `requirements.txt` as the lockfile (what gets installed). Both must be committed together. In a CI pipeline, add a check that `requirements.txt` is consistent with `requirements.in` — similar to how `package.json` + `pnpm-lock.yaml` are kept in sync.

---

## C6: Langfuse v4 broke traces — silent 405 on span export

**What happened:** `pip install langfuse` installed v4.14.0. The pipeline ran, extraction completed (9/13 fields found), but zero traces appeared in the Langfuse dashboard. The API logs showed:

```
Failed to export span batch code: 405, reason: Method Not Allowed
```

**Root cause:** Langfuse v3+ replaced its direct REST API client with an OpenTelemetry (OTEL) exporter. The OTEL SDK sends spans to `/v1/traces` (the standard OTLP endpoint path), but the Langfuse server only accepts traces at `/api/public/otel`. Neither the SDK nor the server gave a useful error message — the pipeline appeared to succeed and traces silently vanished.

**Fix:** Pin `langfuse>=2,<3` in `requirements.in`. Langfuse v2 uses a direct REST client (no OTEL dependency) and works reliably with the `from langfuse.openai import OpenAI` drop-in pattern. Reinstalled with `pip install "langfuse>=2,<3"` → downgraded to 2.60.10.

**Why it matters:** A tracing tool that silently drops traces is worse than no tracing tool — it gives false confidence that everything is instrumented when nothing is. Always trigger a real pipeline run and verify traces appear in the dashboard before claiming observability is wired.

**Interview lesson:** Unpinned dependencies (`langfuse` with no version) will silently upgrade to a breaking major version the next time someone does `pip install`. For observability tooling specifically, pin aggressively — a broken tracer costs you visibility at exactly the moment you need it most (incident investigation). The `requirements.in` + `requirements.txt` two-file pattern is the correct mitigation.

---

## C7: `LANGFUSE_BASE_URL` vs `LANGFUSE_HOST` — dashboard vs SDK mismatch

**What happened:** After downgrading to Langfuse v2, traces still did not appear. The Langfuse dashboard quickstart snippet shows:

```
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

But the Langfuse Python SDK v2 reads a different environment variable:

```
LANGFUSE_HOST=https://cloud.langfuse.com
```

Our `.env` had `LANGFUSE_BASE_URL` (copied from the dashboard) so `settings.langfuse_host` fell back to the default `https://eu.cloud.langfuse.com`, which is the EU region — but the user's account is on the US region `cloud.langfuse.com`. The SDK was sending traces to the wrong host.

**Fix:** Renamed `LANGFUSE_BASE_URL` → `LANGFUSE_HOST` in `apps/api/.env` with the correct value `https://cloud.langfuse.com`.

**Why it matters:** Different Langfuse SDK versions and different languages (Python vs JS) use different environment variable names. Always check the SDK source or Python-specific docs, not the generic dashboard snippet.

**Interview lesson:** When integrating a third-party SDK, always test with a minimal script (`python -c "from langfuse import Langfuse; l = Langfuse(); l.trace(name='test'); l.flush()"`) before wiring into your application. A 30-second smoke test would have caught both C6 and C7 before spending time debugging the full pipeline.

---

## C8: Langfuse flush required in background tasks

**What happened:** Even with the correct host, traces were not appearing because the Langfuse v2 client queues events in memory and flushes them asynchronously on a background thread. In FastAPI `BackgroundTasks`, the worker function exits before the flush thread drains the queue — traces were queued but never sent.

**Fix:** Added `Langfuse().flush()` call at the end of `extract_fields()`:

```python
try:
    Langfuse().flush()
except Exception:
    log.warning("langfuse_flush_failed")
```

`flush()` is a blocking call — it waits until all queued events are delivered to the Langfuse server before returning.

**Why it matters:** Async batch senders are the industry default for observability SDKs (Langfuse, Sentry, DataDog) because they add near-zero latency to the hot path. But they require an explicit flush at process/task exit. In long-running servers this happens at shutdown; in short-lived background tasks you must call it manually.

**Interview lesson:** Any time you use an observability SDK in a non-web-server context (CLI, background job, lambda, test suite), check whether the SDK has a `flush()` or `shutdown()` method and call it before the process exits. The SDK documentation usually mentions this but it is easy to miss.

---

## C9: PostgreSQL rejects null bytes (U+0000) from PDF extraction

**What happened:** Running the pipeline against a real PDF produced by a scanner or with complex embedded fonts gave this Postgres error:

```
'\\u0000 cannot be converted to text.'  (code 22P05)
```

The OCR stage failed and the pipeline was marked `failed`. No extraction ran so no Langfuse traces appeared — two symptoms with one root cause.

**Root cause:** PyMuPDF emits `\x00` (null byte, U+0000) when it cannot decode certain character codes in embedded font tables. The extracted text is valid Python `str` but PostgreSQL's `text` type hard-rejects null bytes — they are not part of the SQL character set.

**Fix:** Strip null bytes immediately after extraction and before any DB write or LLM call:

```python
clean_text = result.text.replace("\x00", "")
```

Applied in `ocr_worker.py` right after `extract()` returns. The word count remains from the original extraction (minor inaccuracy) but the text stored is clean.

**Why it matters:** This error blocks the entire document — OCR fails, extraction is skipped, no Langfuse trace is produced. The failure is silent from the user's perspective (they see "failed" status with no explanation). Stripping null bytes is safe: `\x00` has no semantic content in natural language text.

**Interview lesson:** When storing LLM-extracted or OCR-produced text in a relational database, always sanitise before the DB write. Common issues: null bytes (PDF/OCR), lone surrogates (some Unicode encodings), and text exceeding column length limits. A defensive `text.replace("\x00", "")` in the worker is simpler than catching and re-raising a database error mid-pipeline.
