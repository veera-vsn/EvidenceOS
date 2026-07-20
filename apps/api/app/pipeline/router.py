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
GET /pipeline/workspaces/{workspace_id}/export
    Builds and returns a draft xBRL-CSV zip for every fully-reviewed
    document in a workspace. Per-workspace membership is verified in
    Next.js before this is ever called (see export/download/route.ts).

Every route below requires the `X-Internal-Api-Key` shared-secret header
(see app/core/internal_auth.py) -- this backend is reachable from the
public internet, so that header, not network position, is the actual
authentication boundary as of the 2026-07-18 production audit fix.
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.core.internal_auth import require_internal_api_key
from app.core.rate_limit import limiter
from app.core.supabase import get_service_client
from app.pipeline.export import build_export_zip
from app.pipeline.ocr_worker import run_ocr_for_pipeline
from app.pipeline.revalidate import revalidate_document_version

router = APIRouter(
    prefix="/pipeline",
    tags=["pipeline"],
    dependencies=[Depends(require_internal_api_key)],
)


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
@limiter.shared_limit("20/minute", scope="pipeline-trigger")
async def trigger_pipeline_run(
    request: Request,  # required by @limiter.shared_limit, unused otherwise
    run_id: str,
    background_tasks: BackgroundTasks,
) -> TriggerResponse:
    """Start OCR processing for a queued pipeline run.

    Validates that the run exists and is in 'queued' state, then enqueues
    the OCR worker as a background task. Returns 202 immediately.

    The run status transitions:
        queued → running (set by worker on start)
        running → completed | failed (set by worker on finish)

    Rate-limited to 20/minute across all run_ids (see app/core/rate_limit.py)
    -- this is the one route that triggers real, billed OpenAI calls; a
    runaway retry loop or a leaked internal-auth secret shouldn't be able
    to run up an unbounded bill. Uses shared_limit() with an explicit
    scope, not plain limit(): slowapi's default scope is the raw request
    URL path, which here includes the literal run_id, so plain limit()
    would silently give every run_id its own independent 20/minute bucket
    instead of rate-limiting the endpoint as a whole (caught by the
    dedicated test below actually observing a 429, not just passing).
    """
    client = get_service_client()

    # Validate the run exists and is queued.
    # maybe_single(), not single() -- single() raises a postgrest APIError
    # (PGRST116) for zero rows instead of returning data=None, which would
    # otherwise skip the not-found check below entirely and surface as an
    # unhandled 500 instead of the intended 404 (same fix already applied
    # in export.py's build_export_zip -- found here via the same class of
    # bug, while testing the 2026-07-18 internal-auth fix against a
    # nonexistent run_id).
    resp = (
        client.table("pipeline_runs")
        .select("id, status")
        .eq("id", run_id)
        .maybe_single()
        .execute()
    )

    if not resp or not resp.data:
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


@router.get(
    "/workspaces/{workspace_id}/export",
    status_code=200,
    summary="Export all fully-reviewed documents as a draft xBRL-CSV zip",
)
async def export_workspace(workspace_id: str) -> Response:
    """Build and return the workspace's draft xBRL-CSV export as a zip.

    Built fully in-memory per request -- no persisted export row; the
    output is always cheaply regenerable from extraction_results and
    field_reviews. Only documents whose latest version is both validated
    and fully reviewed are included (see export.determine_export_eligibility).
    """
    try:
        zip_bytes = build_export_zip(workspace_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="evidenceos-export-{workspace_id}.zip"'
        },
    )
