"""Pipeline worker — OCR + field extraction stages.

Called by the trigger endpoint (POST /pipeline/runs/{run_id}/trigger).
Runs synchronously inside a FastAPI BackgroundTask so the HTTP response
returns immediately while the work happens behind the scenes.

Lifecycle per run:
    1. Mark pipeline_run.status = 'running', set started_at.
    2. For each pipeline_run_document in the run:
       a. OCR stage: download file, extract text, upsert document_text.
       b. Extraction stage: call Claude to identify DORA RoI fields,
          upsert results into extraction_results.
       c. Each stage is independently marked running → completed | failed.
          A failure in OCR skips extraction for that document.
    3. Mark pipeline_run.status = 'completed' (or 'failed' if all docs failed).

All DB writes use the service-role client (bypasses RLS — the worker is a
trusted internal process, not acting on behalf of an end user).
"""

from __future__ import annotations

import structlog

from app.core.supabase import get_service_client
from app.pipeline.extractor import extract
from app.pipeline.field_extractor import extract_fields

log = structlog.get_logger(__name__)


def run_ocr_for_pipeline(run_id: str) -> None:
    """Process all documents in *run_id* through OCR and field extraction.

    Must not raise — all errors are caught, logged, and reflected in the
    DB status columns so the UI can show per-stage failures.

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
            "document_versions(storage_path, documents(name, file_type))"
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

        version = doc.get("document_versions") or {}
        document = version.get("documents") or {}
        storage_path: str = version.get("storage_path", "")
        file_type: str = document.get("file_type", "")
        doc_name: str = document.get("name", "unknown")

        # ------------------------------------------------------------------
        # Stage A: OCR
        # ------------------------------------------------------------------
        ocr_ok = False
        extracted_text = ""

        try:
            if not storage_path or not file_type:
                raise ValueError(f"Missing storage_path or file_type for version {version_id}")

            client.table("pipeline_run_documents").update(
                {"ocr_status": "running"}
            ).eq("pipeline_run_id", run_id).eq("document_version_id", version_id).execute()

            doc_log.info("downloading_file", storage_path=storage_path)
            file_bytes: bytes = client.storage.from_("documents").download(storage_path)

            doc_log.info("extracting_text", file_type=file_type)
            result = extract(file_type, file_bytes)
            extracted_text = result.text
            doc_log.info("ocr_done", extractor=result.extractor, word_count=result.word_count)

            client.table("document_text").upsert(
                {
                    "document_version_id": version_id,
                    "content": result.text,
                    "word_count": result.word_count,
                    "extractor": result.extractor,
                },
                on_conflict="document_version_id",
            ).execute()

            client.table("pipeline_run_documents").update(
                {"ocr_status": "completed"}
            ).eq("pipeline_run_id", run_id).eq("document_version_id", version_id).execute()

            ocr_ok = True

        except Exception as exc:
            failed_count += 1
            doc_log.error("ocr_stage_failed", error=str(exc))
            client.table("pipeline_run_documents").update(
                {"ocr_status": "failed", "extraction_status": "skipped"}
            ).eq("pipeline_run_id", run_id).eq("document_version_id", version_id).execute()
            continue  # skip extraction if OCR failed

        # ------------------------------------------------------------------
        # Stage B: Field extraction (only if OCR succeeded)
        # ------------------------------------------------------------------
        if ocr_ok and extracted_text:
            try:
                client.table("pipeline_run_documents").update(
                    {"extraction_status": "running"}
                ).eq("pipeline_run_id", run_id).eq("document_version_id", version_id).execute()

                doc_log.info("running_field_extraction", document=doc_name)
                fields = extract_fields(extracted_text, doc_name, document_version_id=version_id)

                rows = [
                    {
                        "document_version_id": version_id,
                        "field_code": f.field_code,
                        "field_label": f.field_label,
                        "extracted_value": f.extracted_value,
                        "confidence": f.confidence,
                        "extraction_method": f.extraction_method,  # 'gpt-4o-mini'
                    }
                    for f in fields
                ]
                client.table("extraction_results").upsert(
                    rows, on_conflict="document_version_id,field_code"
                ).execute()

                client.table("pipeline_run_documents").update(
                    {"extraction_status": "completed"}
                ).eq("pipeline_run_id", run_id).eq("document_version_id", version_id).execute()

                found = sum(1 for f in fields if f.extracted_value)
                doc_log.info("extraction_stage_completed", fields_found=found)

            except Exception as exc:
                doc_log.error("extraction_stage_failed", error=str(exc))
                client.table("pipeline_run_documents").update(
                    {"extraction_status": "failed"}
                ).eq("pipeline_run_id", run_id).eq("document_version_id", version_id).execute()
        elif ocr_ok and not extracted_text:
            # Empty text (e.g. scanned PDF) — mark extraction as skipped.
            client.table("pipeline_run_documents").update(
                {"extraction_status": "skipped"}
            ).eq("pipeline_run_id", run_id).eq("document_version_id", version_id).execute()
            doc_log.info("extraction_skipped_empty_text")

    # ------------------------------------------------------------------
    # 3. Mark run as completed or failed
    # ------------------------------------------------------------------
    final_status = "failed" if failed_count == len(docs) else "completed"
    client.table("pipeline_runs").update(
        {"status": final_status, "completed_at": "now()"}
    ).eq("id", run_id).execute()

    worker_log.info("pipeline_run_finished", status=final_status, failed=failed_count)
