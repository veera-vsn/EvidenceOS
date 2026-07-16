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

DORA field codes follow the real EBA DPM 4.0 table structure — RT.02.01
(contractual arrangements, general info), RT.02.02 (contractual
arrangements, specific info), RT.05.01 (ICT third-party provider
register), RT.06.01 (functions identification). Verified directly against
EBA's own "Annotated Table Layout — DORA 4.0" reference and the "Overview
of the RoI reporting technical checks and validation rules" workbook
(April 2025) — not RT.01.01/RT.03.01 as an earlier, incorrect version of
this catalogue assumed. See
Project_Docs/Learnings/Phase_4_Validation/CHALLENGES.md for what that
correction involved.

Full RoI Stage 1 (Project_Docs/Learnings/Phase_9_Full_RoI_Stage1/) expanded
this catalogue from 13 to every real column of these same 4 tables (45
fields total), sourced directly from EBA's own "Data Model for DORA RoI"
PDF and cross-checked against the DORA validation-rules workbook. Enum
hints below (e.g. "Standalone arrangement / Overarching arrangement /
...") are the literal EBA dropdown values from "List of possible values
for all data fields with drop downs" — not invented.

Reference:
  ESMA/EBA/EIOPA Joint ITS on DORA RoI (2024)
  https://www.eba.europa.eu/regulation-and-policy/operational-resilience
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import structlog
from langfuse import Langfuse
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
    # RT.02.01 — Contractual arrangements, general information (EBA table B_02.01) — 5/5 columns
    {
        "code": "b_02.01.0010",
        "label": "Contractual arrangement reference number",
        "hint": "Unique identifier or reference number for this contract",
    },
    {
        "code": "b_02.01.0020",
        "label": "Type of contractual arrangement",
        "hint": (
            "One of: Standalone arrangement / Overarching arrangement / "
            "Subsequent or associated arrangement"
        ),
    },
    {
        "code": "b_02.01.0030",
        "label": "Overarching contractual arrangement reference number",
        "hint": (
            "Reference number of the master/overarching agreement this "
            "arrangement falls under, if any"
        ),
    },
    {
        "code": "b_02.01.0040",
        "label": "Currency of the amount reported",
        "hint": "ISO 4217 3-letter currency code for the annual expense figure",
    },
    {
        "code": "b_02.01.0050",
        "label": (
            "Annual expense or estimated cost of the contractual "
            "arrangement for the past year"
        ),
        "hint": "Numeric monetary amount",
    },
    # RT.02.02 — Contractual arrangements, specific information (EBA table B_02.02) — 18/18 columns
    {
        "code": "b_02.02.0020",
        "label": "LEI of the financial entity making use of the ICT service",
        "hint": (
            "20-character LEI of your own organisation as the "
            "contracting party — often in the signature block"
        ),
    },
    {
        "code": "b_02.02.0030",
        "label": "Identification code of the third-party service provider",
        "hint": "Identifier for the ICT provider (usually its LEI)",
    },
    {
        "code": "b_02.02.0040",
        "label": "Type of code to identify the third-party service provider",
        "hint": (
            "One of: Legal Entity Identifier (LEI) / National code / "
            "European Unified ID (EUID) / Company registration number "
            "(CRN) / Value added tax identification number (VAT) / "
            "Passport Number"
        ),
    },
    {
        "code": "b_02.02.0050",
        "label": "Function identifier",
        "hint": "Reference code linking this arrangement to the business function it supports",
    },
    {
        "code": "b_02.02.0060",
        "label": "Type of ICT services",
        "hint": "Category of ICT services (e.g. cloud, data analytics, software, network)",
    },
    {
        "code": "b_02.02.0070",
        "label": "Start date of contractual arrangement",
        "hint": "Date the contract became effective (ISO 8601: YYYY-MM-DD)",
    },
    {
        "code": "b_02.02.0080",
        "label": "End date of contractual arrangement",
        "hint": "Date the contract expires or was terminated (ISO 8601 if present)",
    },
    {
        "code": "b_02.02.0090",
        "label": "Reason of the termination or ending of the contractual arrangement",
        "hint": (
            "One of: Termination not for cause: expired and not renewed / "
            "Termination for cause: provider in breach of law, regulation "
            "or contract / Termination for cause: identified impediments "
            "capable of altering the supported function / Termination for "
            "cause: provider weaknesses in managing/securing sensitive "
            "data / Termination as requested by the competent authority / "
            "Other reasons"
        ),
    },
    {
        "code": "b_02.02.0100",
        "label": "Notice period for termination — financial entity (days)",
        "hint": "Number of days notice the financial entity must give to terminate the contract",
    },
    {
        "code": "b_02.02.0110",
        "label": "Notice period for termination — ICT provider (days)",
        "hint": "Number of days notice the ICT provider must give to terminate the contract",
    },
    {
        "code": "b_02.02.0120",
        "label": "Country of governing law",
        "hint": "ISO 3166-1 alpha-2 country code of the law governing the contract",
    },
    {
        "code": "b_02.02.0130",
        "label": "Country of provision of the ICT services",
        "hint": "ISO 3166-1 alpha-2 country code where the ICT services are actually provided from",
    },
    {
        "code": "b_02.02.0140",
        "label": "Storage of data",
        "hint": "Yes or No — whether the ICT provider stores data under this arrangement",
    },
    {
        "code": "b_02.02.0150",
        "label": "Location of the data at rest (storage)",
        "hint": "ISO 3166-1 alpha-2 country code where data is stored",
    },
    {
        "code": "b_02.02.0160",
        "label": "Location of management of the data (processing)",
        "hint": "ISO 3166-1 alpha-2 country code where data is processed/managed",
    },
    {
        "code": "b_02.02.0170",
        "label": "Data sensitivity",
        "hint": "One of: Low / Medium / High",
    },
    {
        "code": "b_02.02.0180",
        "label": (
            "Level of reliance on the ICT service supporting the "
            "critical or important function"
        ),
        "hint": "One of: Not significant / Low reliance / Material reliance / Full reliance",
    },
    # RT.05.01 — ICT third-party service provider register (EBA table B_05.01) — 12/12 columns
    {
        "code": "b_05.01.0010",
        "label": "ICT third-party service provider identification code",
        "hint": "Legal Entity Identifier (20-character alphanumeric code) if present",
    },
    {
        "code": "b_05.01.0020",
        "label": "Type of code of the third-party service provider",
        "hint": (
            "One of: Legal Entity Identifier (LEI) / National code / "
            "European Unified ID (EUID) / Company registration number "
            "(CRN) / Value added tax identification number (VAT) / "
            "Passport Number"
        ),
    },
    {
        "code": "b_05.01.0030",
        "label": "Additional identification code of the third-party service provider",
        "hint": (
            "A second identifier for the provider, if the document "
            "gives one besides the primary code"
        ),
    },
    {
        "code": "b_05.01.0040",
        "label": "Type of additional identification code of the third-party service provider",
        "hint": (
            "Same value set as the primary identifier type (LEI / "
            "National code / EUID / CRN / VAT / Passport Number)"
        ),
    },
    {
        "code": "b_05.01.0050",
        "label": "ICT third-party service provider name",
        "hint": "Legal name of the company providing the ICT service",
    },
    {
        "code": "b_05.01.0060",
        "label": "Name of the ICT third-party service provider in Latin alphabet",
        "hint": "Only needed if the legal name above is not already in Latin script",
    },
    {
        "code": "b_05.01.0070",
        "label": "Type of person of the third-party service provider",
        "hint": (
            "One of: Legal person, excluding individual acting in a "
            "business capacity / Individual acting in a business capacity"
        ),
    },
    {
        "code": "b_05.01.0080",
        "label": "Country of registration of ICT provider",
        "hint": "ISO 3166-1 alpha-2 country code where the ICT provider is headquartered",
    },
    {
        "code": "b_05.01.0090",
        "label": "Currency of the amount reported",
        "hint": "ISO 4217 3-letter currency code for the provider's annual expense figure",
    },
    {
        "code": "b_05.01.0100",
        "label": "Total annual expense or estimated cost of the third-party service provider",
        "hint": "Numeric monetary amount",
    },
    {
        "code": "b_05.01.0110",
        "label": (
            "Identification code of the third-party service provider's "
            "ultimate parent undertaking"
        ),
        "hint": (
            "LEI of the provider's ultimate parent company, if the "
            "provider is a subsidiary"
        ),
    },
    {
        "code": "b_05.01.0120",
        "label": (
            "Type of code of the third-party service provider's "
            "ultimate parent undertaking"
        ),
        "hint": (
            "Same value set as the identifier type fields (LEI / "
            "National code / EUID / CRN / VAT / Passport Number)"
        ),
    },
    # RT.06.01 — Functions identification (EBA table B_06.01) — 10/10 columns
    {
        "code": "b_06.01.0010",
        "label": "Function identifier",
        "hint": (
            "Internal reference code identifying this function — usually "
            "an internal reference, rarely stated in a vendor contract"
        ),
    },
    {
        "code": "b_06.01.0020",
        "label": "Licensed activity",
        "hint": (
            "The regulated financial activity this function supports "
            "(free text — EBA maintains a large controlled vocabulary here)"
        ),
    },
    {
        "code": "b_06.01.0030",
        "label": "Function name",
        "hint": "Name of the specific business function or process supported by this ICT service",
    },
    {
        "code": "b_06.01.0040",
        "label": "LEI of the financial entity",
        "hint": (
            "20-character LEI of your own organisation — often in the "
            "signature block or preamble"
        ),
    },
    {
        "code": "b_06.01.0050",
        "label": "Criticality or importance assessment",
        "hint": "One of: Assessment not performed / Yes / No",
    },
    {
        "code": "b_06.01.0060",
        "label": "Reasons for criticality or importance",
        "hint": (
            "Free-text explanation of why the function was assessed "
            "as critical/important (or not)"
        ),
    },
    {
        "code": "b_06.01.0070",
        "label": "Date of the last assessment of criticality or importance",
        "hint": "Date the criticality assessment was last performed (ISO 8601: YYYY-MM-DD)",
    },
    {
        "code": "b_06.01.0080",
        "label": "Recovery time objective of the function",
        "hint": "Target time to restore the function after disruption, in hours",
    },
    {
        "code": "b_06.01.0090",
        "label": "Recovery point objective of the function",
        "hint": "Maximum tolerable data loss for the function, in hours",
    },
    {
        "code": "b_06.01.0100",
        "label": "Impact of discontinuing the function",
        "hint": "One of: Low / Medium / High / Assessment not performed",
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
        # 45 fields (up from 13 pre-Stage-1) means a larger JSON response —
        # 2048 was tight even for 13; give real headroom rather than risk
        # silent truncation of the trailing fields.
        max_tokens=4096,
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

    # Langfuse batches traces asynchronously. In a FastAPI BackgroundTask the
    # worker exits before the queue drains, so traces never reach the dashboard.
    # flush() blocks until all queued events are sent.
    try:
        Langfuse().flush()
    except Exception:
        log.warning("langfuse_flush_failed")

    return results
