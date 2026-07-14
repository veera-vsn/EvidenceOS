# Phase 3 — DORA Field Extraction + LLM Observability

## What we built

An AI extraction pipeline that reads plain text produced by the Phase 2 OCR stage and uses GPT-4o-mini to identify and extract structured DORA Register of Information (RoI) fields from ICT contract documents.

Every LLM call is fully traced in **Langfuse** (EU region, Frankfurt) with model name, token counts, cost, latency, and document metadata. This gives us a reproducible baseline before any prompt optimisation or model-swapping experiments.

## Why it matters

DORA Article 28(3) requires financial entities to maintain a Register of Information with 116+ structured fields across three ESMA ITS reporting templates (RT.01.01, RT.02.01, RT.03.01). Filling these manually from contract PDFs takes a compliance analyst 4–8 hours per vendor. We reduce that to a first-pass extraction in seconds, with human review for the final call.

The **baseline-first** principle is critical: you cannot optimise what you cannot measure. By instrumenting every LLM call before touching the prompt, we know the starting cost, latency, and accuracy — and every future change is an experiment against that baseline.

## How it fits in the pipeline

```
Upload (Phase 1) → OCR / text extraction (Phase 2) → Field extraction (Phase 3)
                                                              ↓
                                                    extraction_results (Supabase)
                                                              ↓
                                               Human review UI (Phase 5 — future)
```

## Files introduced

| File | Purpose |
|---|---|
| `apps/api/app/pipeline/field_extractor.py` | DORA field catalogue + GPT-4o-mini extraction + Langfuse tracing |
| `supabase/migrations/0007_extraction_results.sql` | Persistent store for per-field extraction output |
| `apps/web/src/lib/supabase/database.types.ts` | TypeScript types for `extraction_results` table |
| `apps/web/src/app/dashboard/[workspaceSlug]/pipeline/page.tsx` | UI grid showing extracted fields with confidence pips |

`ocr_worker.py` was updated to call `extract_fields()` after OCR succeeds (Stage B).  
`config.py` and `.env` were updated with `OPENAI_API_KEY` and Langfuse key placeholders.

## Key design decisions

**GPT-4o-mini over GPT-4o** — sufficient for structured extraction at ~10× lower cost. The Langfuse dashboard will surface whether accuracy needs the bigger model.

**JSON mode (`response_format={"type": "json_object"}`)** — guarantees parseable output. No markdown wrapping, no explanation — just `{"fields": [...]}`. The alternative (hoping the model follows formatting instructions) is fragile in production.

**`from langfuse.openai import OpenAI`** — Langfuse's drop-in wrapper intercepts every `client.chat.completions.create()` call without modifying the call site. This is the zero-friction instrumentation pattern: no decorators, no context managers.

**Field code fill-in** — if the model omits a code (e.g. LEI not present in a simple contract), `extract_fields()` appends a `None / 0.0` record. This ensures the UI always shows all 13 fields, making the "what is missing" question visually obvious.

**EU data residency** — Langfuse host is forced to `https://eu.cloud.langfuse.com` (Frankfurt). OpenAI data is not stored in Langfuse — only token counts, latency, and the structured `extracted_value` JSON.

## Interview Q&A

**Q: Why Langfuse and not MLflow or Weights & Biases?**  
A: Langfuse is purpose-built for LLM traces — it understands prompt/completion pairs, token costs, and confidence scoring natively. MLflow is ML experiment tracking, not LLM observability. W&B Weave is US-region only. For an EU-regulated product, Langfuse EU is the correct choice.

**Q: How do you ensure the extraction is repeatable?**  
A: `temperature=0` on every call. GPT-4o-mini with temperature 0 is deterministic for the same prompt and document. Field order is fixed by the `DORA_FIELDS` list; any codes the model skips are filled in programmatically.

**Q: What happens when the model hallucinates a field code?**  
A: `extract_fields()` checks every returned `field_code` against `known_codes` (a set from `DORA_FIELDS`). Unknown codes are silently dropped. The fill-in loop then adds any genuinely missing codes with `None / 0.0`.

**Q: Why 12,000-character truncation?**  
A: GPT-4o-mini has a 128k context window but the relevant fields in an ICT contract almost always appear in the first 10–15 pages. Truncating keeps cost low and latency fast; if we need deeper extraction we can implement chunking as a Phase 4 experiment.
