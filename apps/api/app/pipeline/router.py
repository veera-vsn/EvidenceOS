"""FastAPI router for pipeline operations.

Mounted at /pipeline in main.py.

Endpoints
---------
POST /pipeline/runs/{run_id}/trigger
    Kicks off the OCR worker for a queued pipeline run.
    Returns immediately (202 Accepted); the worker runs as a BackgroundTask.
POST /pipeline/documents/{document_version_id}/revalidate
    Re-runs deterministic validation for one document version after a human
    review edit. Runs synchronously -- the caller awaits it.
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.core.supabase import get_service_client
from app.pipeline.ocr_worker import run_ocr_for_pipeline
from app.pipeline.revalidate import revalidate_document_version

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


class TriggerResponse(BaseModel):
    """Response body for the trigger endpoint."""

    run_id: str
    status: str
    message: str


@router.post(
    "/runs/{run_id}/trigger",
    response_model=TriggerResponse,
    status_code=202,
    summary="Trigger OCR processing for a pipeline run",
)
async def trigger_pipeline_run(
    run_id: str,
    background_tasks: BackgroundTasks,
) -> TriggerResponse:
    """Start OCR processing for a queued pipeline run.

    Validates that the run exists and is in 'queued' state, then enqueues
    the OCR worker as a background task. Returns 202 immediately.

    The run status transitions:
        queued → running (set by worker on start)
        running → completed | failed (set by worker on finish)
    """
    client = get_service_client()

    # Validate the run exists and is queued.
    resp = (
        client.table("pipeline_runs")
        .select("id, status")
        .eq("id", run_id)
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail=f"Pipeline run {run_id!r} not found.")

    current_status = resp.data["status"]
    if current_status != "queued":
        raise HTTPException(
            status_code=409,
            detail=f"Run is in status {current_status!r}. Only 'queued' runs can be triggered.",
        )

    background_tasks.add_task(run_ocr_for_pipeline, run_id)

    return TriggerResponse(
        run_id=run_id,
        status="accepted",
        message="OCR processing started in the background.",
    )


class RevalidateResponse(BaseModel):
    """Response body for the revalidate endpoint."""

    document_version_id: str
    rules_evaluated: int


@router.post(
    "/documents/{document_version_id}/revalidate",
    response_model=RevalidateResponse,
    status_code=200,
    summary="Re-run deterministic validation after a human review edit",
)
async def revalidate_document(document_version_id: str) -> RevalidateResponse:
    """Recompute validation_results for one document version.

    Runs synchronously (not a BackgroundTask) and is called *awaited* by the
    review Server Action immediately after a field_reviews upsert, so the
    caller has the updated validation_results before it revalidates the
    Next.js page cache.
    """
    rules_evaluated = revalidate_document_version(document_version_id)
    return RevalidateResponse(
        document_version_id=document_version_id,
        rules_evaluated=rules_evaluated,
    )
