"""DORA RoI field extraction using OpenAI + Langfuse observability.

Reads the plain text produced by the OCR stage and asks GPT-4o-mini to
identify DORA Register of Information fields present in the document.

Every LLM call is traced in Langfuse (EU region) with:
  - model name and version
  - prompt and completion tokens
  - cost (calculated by Langfuse automatically)
  - latency
  - extracted output (for quality review)
  - document name (as user metadata)

This gives us the baseline we need before optimising prompts or swapping
models. The Langfuse dashboard at eu.cloud.langfuse.com shows cost trends,
latency histograms, and per-field accuracy once human review scores are fed
back in Phase 5.

DORA field codes follow the ESMA ITS taxonomy — RT.01.01 (contractual
arrangements), RT.02.01 (ICT TPP register), RT.03.01 (outsourced functions).

Reference:
  ESMA/EBA/EIOPA Joint ITS on DORA RoI (2024)
  https://www.eba.europa.eu/regulation-and-policy/operational-resilience
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import structlog
from langfuse.openai import OpenAI  # drop-in replacement — auto-traces all calls

from app.core.config import get_settings

log = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# DORA RoI field catalogue
# Only fields extractable from contract text are listed here.
# Fields requiring manual input (LEI lookup, internal risk scoring) are
# excluded — they belong in the human review workflow (Phase 5).
# ---------------------------------------------------------------------------

DORA_FIELDS: list[dict[str, str]] = [
    # RT.01.01 — Contractual arrangements
    {
        "code": "b_01.01.0010",
        "label": "Contractual arrangement reference number",
        "hint": "Unique identifier or reference number for this contract",
    },
    {
        "code": "b_01.01.0020",
        "label": "Type of ICT services",
        "hint": "Category of ICT services (e.g. cloud, data analytics, software, network)",
    },
    {
        "code": "b_01.01.0030",
        "label": "Start date of contractual arrangement",
        "hint": "Date the contract became effective (ISO 8601: YYYY-MM-DD)",
    },
    {
        "code": "b_01.01.0040",
        "label": "End date of contractual arrangement",
        "hint": "Date the contract expires or was terminated (ISO 8601 if present)",
    },
    {
        "code": "b_01.01.0050",
        "label": "Notice period for termination (days)",
        "hint": "Number of days notice required to terminate the contract",
    },
    {
        "code": "b_01.01.0060",
        "label": "Governing law",
        "hint": "Jurisdiction whose law governs the contract (e.g. English law, Irish law)",
    },
    {
        "code": "b_01.01.0070",
        "label": "Country of governing law",
        "hint": "ISO 3166-1 alpha-2 country code of the governing law jurisdiction",
    },
    # RT.02.01 — ICT third-party service providers
    {
        "code": "b_02.01.0010",
        "label": "ICT third-party service provider name",
        "hint": "Legal name of the company providing the ICT service",
    },
    {
        "code": "b_02.01.0020",
        "label": "ICT third-party service provider LEI",
        "hint": "Legal Entity Identifier (20-character alphanumeric code) if present",
    },
    {
        "code": "b_02.01.0030",
        "label": "Country of registration of ICT provider",
        "hint": "ISO 3166-1 alpha-2 country code where the ICT provider is registered",
    },
    # RT.03.01 — Functions outsourced
    {
        "code": "b_03.01.0010",
        "label": "Function or service outsourced",
        "hint": "Description of the specific function or business process being outsourced",
    },
    {
        "code": "b_03.01.0020",
        "label": "Criticality or importance assessment",
        "hint": "Whether the function is critical or important (yes/no or critical/non-critical)",
    },
    {
        "code": "b_03.01.0030",
        "label": "Data sensitivity",
        "hint": "Types of personal or sensitive data processed under this arrangement",
    },
]


@dataclass
class ExtractionField:
    """A single extracted DORA RoI field value."""

    field_code: str
    field_label: str
    extracted_value: str | None
    confidence: float
    extraction_method: str = "gpt-4o-mini"


def _build_langfuse_client() -> OpenAI:
    """Initialise the Langfuse-wrapped OpenAI client.

    Langfuse credentials are read from settings. If keys are missing,
    tracing is silently disabled — the OpenAI call still works.
    """
    settings = get_settings()

    # Langfuse reads these env vars automatically when set:
    #   LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST
    # We set them explicitly from settings so pydantic-settings controls
    # the source of truth.
    import os
    if settings.langfuse_public_key:
        os.environ["LANGFUSE_PUBLIC_KEY"] = settings.langfuse_public_key
    if settings.langfuse_secret_key:
        os.environ["LANGFUSE_SECRET_KEY"] = settings.langfuse_secret_key
    if settings.langfuse_host:
        os.environ["LANGFUSE_HOST"] = settings.langfuse_host

    return OpenAI(api_key=settings.openai_api_key)


def extract_fields(
    text: str,
    document_name: str,
    document_version_id: str | None = None,
) -> list[ExtractionField]:
    """Extract DORA RoI fields from document text using GPT-4o-mini.

    Every call is traced in Langfuse with token counts, cost, latency,
    and the document name as session metadata. This forms the baseline
    dataset for prompt optimisation and model comparison experiments.

    Args:
        text:                 Plain text produced by the OCR stage.
        document_name:        Filename — used in the prompt and as Langfuse
                              session name for filtering in the dashboard.
        document_version_id:  Optional UUID — attached as Langfuse metadata
                              so traces are linkable back to the DB row.

    Returns:
        List of ExtractionField — one per entry in DORA_FIELDS.
        Fields not found have extracted_value=None and confidence=0.0.
    """
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured. Add it to apps/api/.env."
        )

    client = _build_langfuse_client()

    field_lines = "\n".join(
        f'- {f["code"]}: {f["label"]} — {f["hint"]}' for f in DORA_FIELDS
    )

    truncated_text = text[:12_000]
    truncation_note = (
        " (truncated to first 12,000 chars)" if len(text) > 12_000 else ""
    )

    system_prompt = (
        "You are a DORA (Digital Operational Resilience Act) compliance analyst. "
        "Extract structured data from ICT contract documents. "
        "Respond only with valid JSON — no markdown, no explanation."
    )

    user_prompt = f"""Document name: "{document_name}"{truncation_note}

Extract the following DORA Register of Information fields from the document text below.
For each field return the extracted value and a confidence score 0.0-1.0.
If a field is not present, set extracted_value to null and confidence to 0.0.

Fields to extract:
{field_lines}

Respond with a JSON object with a single key "fields" containing an array.
Each array element must have exactly:
  - "field_code": string (the code from the list above)
  - "extracted_value": string or null
  - "confidence": number between 0.0 and 1.0

Document text:
---
{truncated_text}
---"""

    log.info(
        "calling_openai_for_extraction",
        document=document_name,
        fields=len(DORA_FIELDS),
        version_id=document_version_id,
    )

    # Langfuse traces this call automatically.
    # In the dashboard: model, tokens, cost, latency are all visible.
    # name= sets the trace name; metadata= is searchable in the UI.
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0,
        max_tokens=2048,
        # Langfuse trace metadata — visible in the dashboard
        name=f"dora-field-extraction/{document_name}",
        metadata={
            "document_name": document_name,
            "document_version_id": document_version_id or "",
            "field_count": len(DORA_FIELDS),
            "text_truncated": len(text) > 12_000,
            "phase": "3-field-extraction",
        },
    )

    raw_json = response.choices[0].message.content or ""

    try:
        payload: dict = json.loads(raw_json)
        items: list[dict] = payload.get("fields", [])
    except json.JSONDecodeError as exc:
        log.error("openai_response_not_json", error=str(exc), raw=raw_json[:200])
        raise ValueError(f"OpenAI returned invalid JSON: {exc}") from exc

    code_to_label = {f["code"]: f["label"] for f in DORA_FIELDS}
    known_codes = set(code_to_label.keys())

    results: list[ExtractionField] = []
    returned_codes: set[str] = set()

    for item in items:
        code = item.get("field_code", "")
        if code not in known_codes:
            continue
        returned_codes.add(code)
        results.append(
            ExtractionField(
                field_code=code,
                field_label=code_to_label[code],
                extracted_value=item.get("extracted_value") or None,
                confidence=float(item.get("confidence", 0.0)),
            )
        )

    # Fill in codes the model omitted.
    for field in DORA_FIELDS:
        if field["code"] not in returned_codes:
            results.append(
                ExtractionField(
                    field_code=field["code"],
                    field_label=field["label"],
                    extracted_value=None,
                    confidence=0.0,
                )
            )

    found = sum(1 for r in results if r.extracted_value)
    log.info(
        "extraction_complete",
        document=document_name,
        total=len(results),
        found=found,
        version_id=document_version_id,
    )
    return results
