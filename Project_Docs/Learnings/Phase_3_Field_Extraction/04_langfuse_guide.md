# Langfuse — Complete Observability Guide for EvidenceOS

Langfuse is the LLM observability platform wired into our extraction pipeline.
This document covers everything you need to know: the concepts, the dashboard,
how to use it day-to-day, and how to run experiments.

Dashboard: **https://cloud.langfuse.com**

---

## 1. Core concepts

### Trace
A trace is one end-to-end LLM interaction. In our pipeline, one trace = one
document processed through `extract_fields()`. Each trace contains:
- The full prompt sent to GPT-4o-mini
- The raw JSON response
- Token counts (input + output)
- Cost (calculated from OpenAI pricing)
- Latency (wall-clock time for the API call)
- Custom metadata we attach (`document_name`, `document_version_id`, `phase`)

### Span
A span is a sub-step within a trace. In v2, the OpenAI drop-in creates one
span per `chat.completions.create()` call. Future phases (chunking, re-ranking)
will add multiple spans per trace.

### Generation
The specific LLM call within a span — model name, messages, temperature,
response. This is what Langfuse uses to calculate token cost.

### Score
A quality evaluation attached to a trace. Examples:
- Human reviewer marks extraction as "correct" / "incorrect"
- Automated regex check: "does extracted date match ISO 8601?"

We will add scores in Phase 5 (human review UI).

---

## 2. What to look at in the dashboard

### Traces tab
**Default view** — list of all traces, newest first.

| Column | What it tells you |
|---|---|
| Name | `dora-field-extraction/<filename>` — lets you filter by document |
| Latency | How long the OpenAI call took (p50/p95 matter for UX) |
| Cost | USD cost of this single extraction |
| Input tokens | Length of prompt sent |
| Output tokens | Length of JSON response |
| Timestamp | When the extraction ran |

**Click a trace** to see:
- Full prompt (system + user messages)
- Raw JSON response from GPT-4o-mini
- Token breakdown
- All custom metadata we attached

**Filter traces** by:
- Date range — useful for "how much did we spend this week?"
- Name pattern — filter `dora-field-extraction/aws*` to see only AWS contracts
- Metadata — filter by `document_version_id` to find a specific document's trace

### Dashboard tab
Graphs over time:
- **Trace count** — how many extractions ran (usage volume)
- **Total cost** — cumulative spend on OpenAI calls
- **Average latency** — if this creeps up, the model is being hit with longer prompts

**Check this weekly** to catch unexpected cost spikes.

### Models tab
Shows cost breakdown by model. Right now: 100% `gpt-4o-mini`.
When we run experiments with `gpt-4o`, this view shows the cost difference.

---

## 3. Understanding a single trace

When you click a trace in the Traces tab, you see:

```
Trace: dora-field-extraction/aws_customer_agreement.pdf
├── Input tokens:  3,240
├── Output tokens: 420
├── Cost:          $0.0008
├── Latency:       2.3s
│
├── Metadata
│   ├── document_name: aws_customer_agreement.pdf
│   ├── document_version_id: c242f291-b0db-44db-...
│   ├── field_count: 13
│   ├── text_truncated: false
│   └── phase: 3-field-extraction
│
└── Generation (the actual LLM call)
    ├── Model: gpt-4o-mini
    ├── System prompt: "You are a DORA compliance analyst..."
    ├── User prompt: "Document name: aws_customer_agreement.pdf..."
    └── Response: {"fields": [{"field_code": "b_02.02.0070", ...}]}
```

**What to check on a bad extraction:**
1. Click the trace → open the Generation → read the user prompt
2. Check: did the text truncate? (`text_truncated: true` in metadata)
3. Read the raw response — did the model return all 13 fields?
4. If a field is wrong, look at what text the model saw for that section

---

## 4. Cost monitoring

### Current baseline (gpt-4o-mini, 13 fields)
- Input tokens per extraction: ~3,000–4,000 (depends on document length)
- Output tokens per extraction: ~300–500
- Cost per extraction: **~$0.001–0.003** (less than half a cent)
- 1,000 extractions/month: **~$1–3/month**

### How to check costs in the dashboard
1. Go to **Dashboard** tab
2. Set date range to "Last 30 days"
3. Read "Total Cost" — this is your OpenAI spend for extractions

### Cost anomaly signs
- A single trace costs >$0.01 → prompt is unexpectedly long (text not truncating?)
- Cost per trace increasing over time → model input growing (more fields added?)
- Spike in trace count → something triggered bulk reprocessing

### Alerting (set this up)
Langfuse does not have native alerts in the free tier. Use OpenAI's usage dashboard
(`platform.openai.com/usage`) to set a monthly spend limit so you never get
surprised by a runaway job.

---

## 5. Running experiments

The MLOps workflow we follow: **baseline → experiment → compare → decide**.

### How to tag an experiment

In `field_extractor.py`, change the `metadata` dict:

```python
metadata={
    "document_name": document_name,
    "document_version_id": document_version_id or "",
    "field_count": len(DORA_FIELDS),
    "text_truncated": len(text) > 12_000,
    "phase": "3-field-extraction",
    "experiment": "baseline",   # ← change to "exp-A-few-shot" for an experiment
},
```

Filter by `metadata.experiment` in the Traces tab to compare baseline vs. experiment.

### Planned experiments (Phase 4+)

| Experiment | Change | Hypothesis |
|---|---|---|
| `exp-A-few-shot` | Add 2 example (document→fields) pairs to system prompt | +10% accuracy on dates, -5% cost neutral |
| `exp-B-chunking` | Split >12k chars into 3 overlapping chunks, merge results | Higher recall on long contracts |
| `exp-C-gpt4o` | Use `gpt-4o` for critical fields only (b_06.01.0050) | +accuracy on criticality assessment at 10× cost |
| `exp-D-structured-output` | Use OpenAI structured outputs (strict schema) | Eliminate hallucinated field codes |

### Comparing experiments
1. Run baseline extraction on 5 documents from `test_documents/`
2. Change prompt / model
3. Run same 5 documents again (with `experiment: "exp-A"` in metadata)
4. In Langfuse Traces tab: filter by `experiment=baseline` vs `experiment=exp-A`
5. Compare: average cost, average latency, manually check 3–5 extracted values

---

## 6. Accuracy tracking (coming in Phase 5)

Right now we can measure cost and latency. Accuracy requires human review scores.

When the human review UI is built (Phase 5), the workflow will be:
1. Human reviews extraction → marks fields as "correct" / "incorrect" / "needs-edit"
2. Our Server Action calls Langfuse Scores API:

```python
from langfuse import Langfuse

lf = Langfuse()
lf.score(
    trace_id="...",        # from extraction_results metadata
    name="field_accuracy",
    value=0.85,            # 11/13 fields correct
    comment="Governing law field hallucinated jurisdiction",
)
```

3. Langfuse Dashboard → Scores tab shows accuracy by model, prompt, document type

This creates the feedback loop: extraction → human review → score → prompt improvement.

---

## 7. Searching for a specific document's trace

Given a `document_version_id` (e.g. from the Supabase dashboard), find its trace:

1. Langfuse → Traces tab
2. Click **Filters** → **Metadata** → key: `document_version_id`, value: `<uuid>`
3. The matching trace appears

This links the observability layer (Langfuse) to the data layer (Supabase) — you can
jump from a bad extraction result in the DB directly to the trace that produced it.

---

## 8. Interview Q&A

**Q: What's the difference between a trace and a log line?**
A: A log line is a string at a point in time. A trace is a structured record of
a complete LLM interaction — it has input, output, token counts, cost, and latency
as first-class fields. You can filter, sort, and compare across thousands of traces
in ways that are impractical with unstructured logs.

**Q: How do you know if your prompt is getting worse over time?**
A: Langfuse's Dashboard tab shows average cost and latency over time. If input
tokens are growing, the prompt is getting longer (unintentional). If latency is
rising at constant token count, the model is under load. For accuracy degradation,
you need human scores — there is no automatic way to detect if extraction quality
dropped without ground truth.

**Q: What would you do if OpenAI costs doubled tomorrow?**
A: Three levers. (1) Swap model: run experiments with a cheaper model on the same
test corpus, compare accuracy drop vs cost saving in Langfuse. (2) Reduce prompt:
strip the hints from DORA_FIELDS if they are not improving accuracy. (3) Cache:
identical document text → skip extraction, return cached results. Langfuse makes
lever 1 measurable in one afternoon.

**Q: Why not just use OpenAI's usage dashboard?**
A: OpenAI usage shows total spend but has no per-document or per-field breakdown.
You cannot tell which document drove a cost spike, replay the prompt that produced
a wrong answer, or compare two prompt versions. Langfuse gives you that granularity.
