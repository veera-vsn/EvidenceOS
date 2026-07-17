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

from app.core.encryption import decrypt_text
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
    # extracted_value is encrypted at rest (app/core/encryption.py) --
    # decrypt before it enters validate_fields()'s comparisons.
    extracted = {
        r["field_code"]: decrypt_text(r["extracted_value"])
        for r in extraction_resp.data or []
    }

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

    # Delete-then-insert, not upsert. validate_fields()'s rule set has
    # changed shape twice now (Stage 1 moved several fields from flat
    # REQUIRED_FIELD to COMPLETENESS_GROUP; Stage 2A added a field whose
    # code coincidentally matched an old, pre-Phase-4 catalogue entry) --
    # an upsert only ever adds or updates rows for (field_code, rule_id)
    # pairs the *current* call returns, so a pair the rule set no longer
    # produces lingers forever and can resurface with a stale message if
    # a field code is ever reused. See
    # Project_Docs/Learnings/Phase_9_Full_RoI_Stage1/CHALLENGES.md C5.
    # Trades a small amount of atomicity (a crash between the two calls
    # leaves this document_version's rows momentarily empty, read by the
    # UI as "not yet validated" -- recoverable by re-running, not data
    # loss) for guaranteed-correct state on every successful call.
    client.table("validation_results").delete().eq(
        "document_version_id", document_version_id
    ).execute()
    if rows:
        client.table("validation_results").insert(rows).execute()

    log.info("revalidation_completed", document_version_id=document_version_id, rows=len(rows))
    return len(rows)
