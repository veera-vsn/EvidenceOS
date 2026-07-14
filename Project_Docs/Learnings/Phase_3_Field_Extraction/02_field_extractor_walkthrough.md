# Phase 3.2 — Field Extractor Walkthrough

File: `apps/api/app/pipeline/field_extractor.py`

## DORA_FIELDS catalogue

```python
DORA_FIELDS: list[dict[str, str]] = [
    {"code": "b_01.01.0010", "label": "Contractual arrangement reference number", "hint": "…"},
    # … 12 more entries
]
```

Each entry has three keys:

- `code` — the ESMA ITS field identifier. Format: `b_<template>_<column>` where template is `01.01` (contractual arrangements), `02.01` (ICT TPP register), or `03.01` (outsourced functions).
- `label` — human-readable name matching the ESMA xBRL-CSV column header.
- `hint` — additional context injected into the prompt to guide the model.

Only extractable fields are in this catalogue. Fields that require LEI lookup (a legal entity database query) or internal risk scoring are excluded — they belong in a separate enrichment step, not AI extraction.

## ExtractionField dataclass

```python
@dataclass
class ExtractionField:
    field_code: str
    field_label: str
    extracted_value: str | None
    confidence: float
    extraction_method: str = "gpt-4o-mini"
```

`extraction_method` defaults to `"gpt-4o-mini"` so the DB row always records which model produced it. When we run model comparison experiments in future, this column becomes the experiment discriminator.

## _build_langfuse_client()

```python
def _build_langfuse_client() -> OpenAI:
    import os
    if settings.langfuse_public_key:
        os.environ["LANGFUSE_PUBLIC_KEY"] = settings.langfuse_public_key
    if settings.langfuse_secret_key:
        os.environ["LANGFUSE_SECRET_KEY"] = settings.langfuse_secret_key
    if settings.langfuse_host:
        os.environ["LANGFUSE_HOST"] = settings.langfuse_host
    return OpenAI(api_key=settings.openai_api_key)
```

The `langfuse.openai.OpenAI` class reads credentials from environment variables at construction time. We bridge from pydantic-settings (the single source of truth for config) to env vars here. If keys are empty, Langfuse tracing silently disables itself — the OpenAI call still works.

The `import os` is inside the function intentionally: this module is imported at startup, and `os` is stdlib so the cost is negligible. Keeping it local makes the function self-contained.

## extract_fields() — the main entrypoint

### Prompt construction

```python
field_lines = "\n".join(
    f'- {f["code"]}: {f["label"]} — {f["hint"]}' for f in DORA_FIELDS
)
```

Each DORA field becomes a bullet line like:  
`- b_01.01.0030: Start date of contractual arrangement — Date the contract became effective (ISO 8601: YYYY-MM-DD)`

This structured format helps GPT-4o-mini map between the output JSON keys and the source document — it sees both the formal code and a human-readable description with a formatting hint.

### Text truncation

```python
truncated_text = text[:12_000]
truncation_note = (
    " (truncated to first 12,000 chars)" if len(text) > 12_000 else ""
)
```

12,000 characters is approximately 3,000 tokens — well within GPT-4o-mini's context window while keeping per-call cost low. The truncation note is appended to the user prompt so the model is aware it may not have seen the full document.

### The OpenAI call

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    response_format={"type": "json_object"},
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ],
    temperature=0,
    max_tokens=2048,
    name=f"dora-field-extraction/{document_name}",
    metadata={
        "document_name": document_name,
        "document_version_id": document_version_id or "",
        "field_count": len(DORA_FIELDS),
        "text_truncated": len(text) > 12_000,
        "phase": "3-field-extraction",
    },
)
```

Key parameters:
- `response_format={"type": "json_object"}` — OpenAI's JSON mode. The model is guaranteed to return parseable JSON. The system prompt instructs "no markdown, no explanation" to enforce the minimal envelope.
- `temperature=0` — fully deterministic. Same document → same output every time.
- `name=` and `metadata=` — Langfuse-specific kwargs that set the trace name and searchable metadata in the dashboard. These kwargs are silently ignored by the standard `openai` library if Langfuse is not wired in, so the code works in both states.

### Response parsing

```python
payload: dict = json.loads(raw_json)
items: list[dict] = payload.get("fields", [])
```

We expect `{"fields": [{"field_code": "…", "extracted_value": "…", "confidence": 0.9}, …]}`.

### Hallucination guard

```python
if code not in known_codes:
    continue
```

Any `field_code` not in our catalogue is dropped. The model occasionally invents codes (e.g. `b_01.01.0080`) when it is uncertain. By checking against the known set, we prevent phantom fields from polluting the DB.

### Fill-in loop

```python
for field in DORA_FIELDS:
    if field["code"] not in returned_codes:
        results.append(ExtractionField(
            field_code=field["code"],
            field_label=field["label"],
            extracted_value=None,
            confidence=0.0,
        ))
```

This guarantees the caller always receives exactly `len(DORA_FIELDS)` records, one per field. The UI can render a complete grid without needing to handle missing rows.

## Interview Q&A

**Q: Why use `response_format={"type": "json_object"}` instead of parsing free text?**  
A: JSON mode is a hard guarantee from the API — the response will always be valid JSON or the call raises an error. Free-text parsing with regex is brittle: the model may wrap output in markdown code fences, add preamble, or mis-indent arrays. In a compliance tool, silent data loss is worse than an explicit error.

**Q: How would you handle a 200-page contract that exceeds your truncation limit?**  
A: Two strategies: (1) chunked extraction — split the text into overlapping windows of ~10,000 chars, run extraction on each, then merge with a second LLM call that resolves conflicts; (2) retrieval — embed the document, embed field descriptions as queries, retrieve the most relevant passages per field. Strategy 2 is the RAG approach planned for Phase 4.

**Q: What does Langfuse show that CloudWatch logs don't?**  
A: Langfuse shows token cost per trace (not just latency), per-field confidence distributions (when you attach evaluations), prompt version comparisons side-by-side, and cost trends over time by document type. CloudWatch requires you to parse logs and build dashboards manually. For an LLM product the cost curve is the business metric — you need it visible by default.
