# Phase 3.3 — LLM Observability with Langfuse

## What is LLM observability?

Traditional application monitoring (uptime, latency, error rate) is necessary but not sufficient for LLM-powered products. You also need:

- **Cost per call** — LLM APIs charge per token; a 10× more expensive model may not be 10× better.
- **Prompt version tracking** — when you change a prompt, you need to compare before/after on the same inputs.
- **Output quality** — correctness cannot be inferred from response time; it requires human or automated evaluation scores.
- **Trace replay** — to debug a wrong extraction, you need to see the exact prompt and response, not just a log line.

Langfuse provides all four in a single EU-hosted dashboard.

## The drop-in replacement pattern

```python
# Standard OpenAI:
from openai import OpenAI

# Langfuse-instrumented (drop-in):
from langfuse.openai import OpenAI
```

The Langfuse SDK monkey-patches the OpenAI client so every `client.chat.completions.create()` call is automatically wrapped in a trace. No decorators, no context managers, no changes to call sites. This is the lowest-friction instrumentation pattern available.

The `name=` and `metadata=` kwargs passed to `create()` are Langfuse extensions:
- `name` sets the trace name in the dashboard (e.g. `dora-field-extraction/contract_aws_2024.pdf`).
- `metadata` is a free JSON dict — searchable in the Langfuse UI for filtering by document, version, phase.

These kwargs are silently ignored by the standard `openai` library, so code that uses this pattern works whether Langfuse is configured or not.

## What Langfuse records per call

| Field | Source | Use |
|---|---|---|
| Trace name | `name=` kwarg | Filter by document or document type |
| Input tokens | OpenAI response header | Cost calculation |
| Output tokens | OpenAI response header | Cost calculation |
| Model | `model=` kwarg | Model comparison experiments |
| Latency | wall-clock timing | p95 latency budgets |
| Prompt | messages array | Prompt version review |
| Completion | response content | Output quality review |
| Metadata | `metadata=` dict | Free-form tagging (phase, version_id, etc.) |

Cost is calculated automatically by Langfuse using OpenAI's published per-token pricing. No manual arithmetic needed.

## EU data residency

`LANGFUSE_HOST=https://eu.cloud.langfuse.com` forces all trace data to Frankfurt. This is required for GDPR compliance because:

1. Trace metadata may include document names (which are potentially client-identifying).
2. The `extracted_value` fields could contain personal data from contracts.
3. Under GDPR Art. 44, personal data may not be transferred outside the EEA without an adequacy decision or appropriate safeguards.

We do **not** send raw document text to Langfuse — only the structured JSON extraction output. The prompt contains up to 12,000 characters of contract text, which is sent to OpenAI (covered by OpenAI's EU data processing addendum). Langfuse stores the prompt for trace replay.

**Architecture note for regulated products:** if prompt logging of contract text is a concern, Langfuse supports masking — you can send a truncated or hashed version of the input for the trace name while still capturing token counts and latency.

## The baseline → experiment cycle

Phase 3 establishes the baseline. Every future prompt or model change is an experiment:

```
Baseline (Phase 3)
  → gpt-4o-mini, current prompt, 13 fields
  → cost: ~$0.002 / document
  → accuracy: TBD (human review in Phase 5)

Experiment A: chunking for 200-page contracts
  → run same prompt on 3 chunks, merge
  → compare: cost ×3, accuracy ↑?

Experiment B: GPT-4o for critical fields
  → run gpt-4o on b_03.01.0020 (criticality) only
  → compare: cost ↑ per field, accuracy ↑?

Experiment C: few-shot examples in system prompt
  → add 2 example (input, output) pairs
  → compare: token cost ↑ ~20%, accuracy ↑?
```

Langfuse makes this comparison trivial: filter by `metadata.phase` to group baseline vs. experiment traces, compare cost and latency distributions side-by-side.

## Langfuse dashboard access

Dashboard: `https://eu.cloud.langfuse.com`

After adding real keys to `apps/api/.env`:
```
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://eu.cloud.langfuse.com
```

Traces appear in the Langfuse UI within seconds of the first pipeline run. No additional configuration needed.

## Interview Q&A

**Q: What's the difference between Langfuse and OpenTelemetry for LLM tracing?**  
A: OpenTelemetry is a general-purpose distributed tracing standard — excellent for service-to-service request tracing. Langfuse extends the concept with LLM-specific semantics: it understands prompt/completion structure, can calculate token costs from model pricing tables, and has a built-in evaluation framework for scoring outputs. For an LLM product, Langfuse gives you the right primitives out of the box.

**Q: How would you alert on cost anomalies?**  
A: Langfuse supports webhooks and has a dashboard alerting feature. For production: set a Langfuse alert on `cost per trace > $0.05` (which would indicate a prompt or document that is unexpectedly long). Back that with a cloud billing alert at the OpenAI organisation level.

**Q: Why not just log token counts to Datadog?**  
A: You could, but you lose prompt replay, side-by-side experiment comparison, and the evaluation framework. For a product where prompt quality is a competitive differentiator, the ability to replay any production trace and score it is worth the additional SaaS cost. Langfuse's EU-hosted free tier covers our current volume.
