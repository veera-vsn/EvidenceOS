"""Re-validation after a human review edit (Phase 5).

Whichever review decision a field receives, its *effective* value for
validation purposes can differ from what the extractor originally found:

  - approved: extractor's value stands unchanged.
  - edited:   reviewer's corrected value replaces it.
  - rejected: reviewer says the extracted value is wrong and no replacement
              was supplied -- treated as blank, so REQUIRED_FIELD (and any
              other rule) reports the same outcome as "nothing was found".
              That is the honest state of a rejected field: the RoI has no
              trustworthy value for it until someone edits or re-extracts.
  - no review yet: falls back to the original extraction_results value.

Independent of ocr_worker.py by design -- revalidation is triggered on
demand by a single field edit, not as part of a pipeline run, and must
never touch pipeline_run / pipeline_run_documents rows.
"""

from __future__ import annotations

from collections.abc import Mapping

import structlog

from app.core.supabase import get_service_client
from app.pipeline.validator import validate_fields

log = structlog.get_logger(__name__)


def compute_effective_values(
    extracted: Mapping[str, str | None],
    reviews: Mapping[str, Mapping[str, str | None]],
) -> dict[str, str | None]:
    """Merge extraction_results with field_reviews into validate_fields() input.

    Pure -- no I/O -- so it is unit-testable without a Supabase client.

    Args:
        extracted: field_code -> extracted_value, from extraction_results.
        reviews: field_code -> {"decision": ..., "edited_value": ...}, from
            field_reviews. Fields with no review row are absent here.
    """
    effective: dict[str, str | None] = dict(extracted)
    for field_code, review in reviews.items():
        decision = review.get("decision")
        if decision == "edited":
            effective[field_code] = review.get("edited_value")
        elif decision == "rejected":
            effective[field_code] = None
        # 'approved' -> leave the original extracted value untouched.
    return effective


def revalidate_document_version(document_version_id: str) -> int:
    """Recompute validation_results for one document_version from current review state.

    Args:
        document_version_id: UUID of the document_versions row to re-validate.

    Returns:
        Number of validation_results rows upserted.
    """
    client = get_service_client()

    extraction_resp = (
        client.table("extraction_results")
        .select("field_code, extracted_value")
        .eq("document_version_id", document_version_id)
        .execute()
    )
    extracted = {r["field_code"]: r["extracted_value"] for r in extraction_resp.data or []}

    review_resp = (
        client.table("field_reviews")
        .select("field_code, decision, edited_value")
        .eq("document_version_id", document_version_id)
        .execute()
    )
    reviews = {r["field_code"]: r for r in review_resp.data or []}

    effective_values = compute_effective_values(extracted, reviews)
    results = validate_fields(effective_values)

    rows = [
        {
            "document_version_id": document_version_id,
            "field_code": r.field_code,
            "rule_id": r.rule_id,
            "rule_label": r.rule_label,
            "status": r.status,
            "message": r.message,
        }
        for r in results
    ]
    client.table("validation_results").upsert(
        rows, on_conflict="document_version_id,field_code,rule_id"
    ).execute()

    log.info("revalidation_completed", document_version_id=document_version_id, rows=len(rows))
    return len(rows)
