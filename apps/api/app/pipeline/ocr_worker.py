"""OCR worker — processes a single pipeline run.

Called by the trigger endpoint (POST /pipeline/runs/{run_id}/trigger).
Runs synchronously inside a FastAPI BackgroundTask so the HTTP response
returns immediately while the work happens behind the scenes.

Lifecycle per run:
    1. Mark pipeline_run.status = 'running', set started_at.
    2. For each pipeline_run_document in the run:
       a. Mark ocr_status = 'running'.
       b. Look up the document_version to get file_type + storage_path.
       c. Download the file binary from Supabase Storage.
       d. Extract text via the extractor module.
       e. Write to document_text (upsert — safe if trigger fires twice).
       f. Mark ocr_status = 'completed'.
       g. On any error: mark ocr_status = 'failed', log and continue.
    3. Mark pipeline_run.status = 'completed' (or 'failed' if all docs failed).

All DB writes use the service-role client (bypasses RLS — the worker is a
trusted internal process, not acting on behalf of an end user).
"""

from __future__ import annotations

import structlog

from app.core.supabase import get_service_client
from app.pipeline.extractor import extract

log = structlog.get_logger(__name__)


def run_ocr_for_pipeline(run_id: str) -> None:
    """Process all documents in *run_id* through the OCR stage.

    This function is designed to be called from a FastAPI BackgroundTasks
    instance. It must not raise — all errors are caught, logged, and
    reflected in the DB status columns.

    Args:
        run_id: UUID of the pipeline_run row to process.
    """
    client = get_service_client()
    worker_log = log.bind(run_id=run_id)

    # ------------------------------------------------------------------
    # 1. Mark run as running
    # ------------------------------------------------------------------
    client.table("pipeline_runs").update(
        {"status": "running", "started_at": "now()"}
    ).eq("id", run_id).execute()
    worker_log.info("pipeline_run_started")

    # ------------------------------------------------------------------
    # 2. Fetch all document rows for this run
    # ------------------------------------------------------------------
    prd_resp = (
        client.table("pipeline_run_documents")
        .select(
            "document_version_id, ocr_status, "
            "document_versions(storage_path, documents(file_type))"
        )
        .eq("pipeline_run_id", run_id)
        .execute()
    )
    docs = prd_resp.data or []
    worker_log.info("pipeline_run_documents_fetched", count=len(docs))

    failed_count = 0

    for doc in docs:
        version_id: str = doc["document_version_id"]
        doc_log = worker_log.bind(document_version_id=version_id)

        try:
            version = doc.get("document_versions") or {}
            document = version.get("documents") or {}
            storage_path: str = version.get("storage_path", "")
            file_type: str = document.get("file_type", "")

            if not storage_path or not file_type:
                raise ValueError(
                    f"Missing storage_path or file_type for version {version_id}"
                )

            # ----------------------------------------------------------------
            # 2a. Mark OCR stage as running
            # ----------------------------------------------------------------
            client.table("pipeline_run_documents").update(
                {"ocr_status": "running"}
            ).eq("pipeline_run_id", run_id).eq(
                "document_version_id", version_id
            ).execute()

            # ----------------------------------------------------------------
            # 2b. Download file from Supabase Storage
            # ----------------------------------------------------------------
            doc_log.info("downloading_file", storage_path=storage_path)
            download_resp = client.storage.from_("documents").download(storage_path)
            # supabase-py returns bytes directly on success
            file_bytes: bytes = download_resp

            # ----------------------------------------------------------------
            # 2c. Extract text
            # ----------------------------------------------------------------
            doc_log.info("extracting_text", file_type=file_type)
            result = extract(file_type, file_bytes)
            doc_log.info(
                "extraction_complete",
                extractor=result.extractor,
                word_count=result.word_count,
            )

            # ----------------------------------------------------------------
            # 2d. Upsert into document_text
            # ----------------------------------------------------------------
            client.table("document_text").upsert(
                {
                    "document_version_id": version_id,
                    "content": result.text,
                    "word_count": result.word_count,
                    "extractor": result.extractor,
                },
                on_conflict="document_version_id",
            ).execute()

            # ----------------------------------------------------------------
            # 2e. Mark OCR stage completed
            # ----------------------------------------------------------------
            client.table("pipeline_run_documents").update(
                {"ocr_status": "completed"}
            ).eq("pipeline_run_id", run_id).eq(
                "document_version_id", version_id
            ).execute()

            doc_log.info("ocr_stage_completed")

        except Exception as exc:
            failed_count += 1
            doc_log.error("ocr_stage_failed", error=str(exc))
            client.table("pipeline_run_documents").update(
                {"ocr_status": "failed"}
            ).eq("pipeline_run_id", run_id).eq(
                "document_version_id", version_id
            ).execute()

    # ------------------------------------------------------------------
    # 3. Mark run as completed or failed
    # ------------------------------------------------------------------
    final_status = "failed" if failed_count == len(docs) else "completed"
    client.table("pipeline_runs").update(
        {"status": final_status, "completed_at": "now()"}
    ).eq("id", run_id).execute()

    worker_log.info("pipeline_run_finished", status=final_status, failed=failed_count)
