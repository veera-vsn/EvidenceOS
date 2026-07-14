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
