"""Integration tests for the /pipeline/* HTTP routes.

Before this file, every route in app/pipeline/router.py had zero test
coverage -- see Project_Docs/AUDIT_2026-07-18.md's Testing Audit. These
tests hit the real routes via FastAPI's TestClient against a real local
database (see conftest.py), not mocks -- the actual point is to prove
the HTTP layer itself (status codes, auth enforcement, real DB
round-trips) works, which the existing pure-function unit tests
(test_validator.py, test_revalidate.py, ...) never could.

The OCR/LLM worker (run_ocr_for_pipeline) is mocked out in the one test
that would otherwise trigger it -- these tests must not make real
OpenAI calls or cost real money; that stage's own logic is out of scope
here (see Project_Docs/AUDIT_2026-07-18.md's noted gap: extractor.py/
field_extractor.py remain untested by anything, a bigger lift than a
mocked HTTP-layer pass).
"""

from __future__ import annotations

import io
import zipfile
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.rate_limit import limiter
from app.core.supabase import get_service_client
from app.pipeline.validator import validate_fields

# ---------------------------------------------------------------------------
# Shared-secret auth (2026-07-18 production audit fix, S1)
# ---------------------------------------------------------------------------


def test_trigger_without_header_returns_401(client: TestClient) -> None:
    response = client.post(f"/pipeline/runs/{uuid4()}/trigger")
    assert response.status_code == 401


def test_trigger_with_wrong_header_returns_401(client: TestClient) -> None:
    response = client.post(
        f"/pipeline/runs/{uuid4()}/trigger",
        headers={"x-internal-api-key": "definitely-not-the-real-secret"},
    )
    assert response.status_code == 401


def test_revalidate_without_header_returns_401(client: TestClient) -> None:
    response = client.post(f"/pipeline/documents/{uuid4()}/revalidate")
    assert response.status_code == 401


def test_export_without_header_returns_401(client: TestClient) -> None:
    response = client.get(f"/pipeline/workspaces/{uuid4()}/export")
    assert response.status_code == 401


def test_health_needs_no_auth_header(client: TestClient) -> None:
    """/health is deliberately exempt -- UptimeRobot and the landing
    page's status pill both call it unauthenticated."""
    response = client.get("/health")
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# POST /pipeline/runs/{run_id}/trigger
# ---------------------------------------------------------------------------


def test_trigger_nonexistent_run_returns_404_not_500(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """Regression test for the .single()-vs-.maybe_single() bug fixed
    alongside the internal-auth change: .single() raised an unhandled
    postgrest APIError for zero rows instead of the intended 404."""
    limiter.reset()  # isolate from other tests' call counts against /trigger
    response = client.post(f"/pipeline/runs/{uuid4()}/trigger", headers=auth_headers)
    assert response.status_code == 404


def test_trigger_non_queued_run_returns_409(
    client: TestClient, auth_headers: dict[str, str], test_pipeline_run: str
) -> None:
    limiter.reset()
    get_service_client().table("pipeline_runs").update({"status": "running"}).eq(
        "id", test_pipeline_run
    ).execute()

    response = client.post(f"/pipeline/runs/{test_pipeline_run}/trigger", headers=auth_headers)
    assert response.status_code == 409


def test_trigger_queued_run_returns_202_and_schedules_worker(
    client: TestClient, auth_headers: dict[str, str], test_pipeline_run: str
) -> None:
    limiter.reset()
    with patch("app.pipeline.router.run_ocr_for_pipeline") as mock_worker:
        response = client.post(f"/pipeline/runs/{test_pipeline_run}/trigger", headers=auth_headers)

    assert response.status_code == 202
    body = response.json()
    assert body["run_id"] == test_pipeline_run
    assert body["status"] == "accepted"
    mock_worker.assert_called_once_with(test_pipeline_run)


def test_trigger_is_rate_limited_after_20_requests_per_minute(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """The one endpoint that triggers real, billed OpenAI calls should
    not be callable without bound -- a runaway retry loop or a leaked
    internal-auth secret shouldn't be able to run up an unbounded bill
    (2026-07-18 audit, API finding A2). limiter.reset() first so this
    test's count isn't polluted by the trigger tests above it, and isn't
    itself left over to affect whatever runs after it.

    This test is also what caught a real bug during implementation:
    @limiter.limit()'s default scope is the raw URL path, which includes
    this route's run_id, so every call had a distinct scope and the
    limit never actually fired despite 100% of the *other* tests
    passing. Switched to shared_limit(scope=...) in router.py -- this
    test failing first (404 instead of 429 on the 21st call) is what
    exposed that, so don't lose it as "redundant" coverage later."""
    limiter.reset()
    try:
        statuses = [
            client.post(f"/pipeline/runs/{uuid4()}/trigger", headers=auth_headers).status_code
            for _ in range(21)
        ]
        # First 20 hit real route logic (404s, since these are random
        # nonexistent run IDs -- the point here is the *count*, not what
        # the route itself returns). The 21st must be rejected by the
        # rate limiter before the route body ever runs.
        assert statuses[:20] == [404] * 20
        assert statuses[20] == 429
    finally:
        limiter.reset()


# ---------------------------------------------------------------------------
# POST /pipeline/documents/{document_version_id}/revalidate
# ---------------------------------------------------------------------------


def test_revalidate_existing_document_version_returns_200(
    client: TestClient, auth_headers: dict[str, str], test_document_version: str
) -> None:
    """No extraction_results/field_reviews rows exist for this fixture,
    so every field is "not extracted" -- validate_fields({}) still
    deterministically evaluates every rule in the catalogue against
    that, which is exactly what should happen for a freshly-uploaded,
    never-extracted document. Asserting against validate_fields({})'s
    own real output (not a hardcoded number) keeps this test correct if
    the rule catalogue ever changes size."""
    response = client.post(
        f"/pipeline/documents/{test_document_version}/revalidate", headers=auth_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["document_version_id"] == test_document_version
    assert body["rules_evaluated"] == len(validate_fields({}))


# ---------------------------------------------------------------------------
# GET /pipeline/workspaces/{workspace_id}/export
# ---------------------------------------------------------------------------


def test_export_nonexistent_workspace_returns_404(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.get(f"/pipeline/workspaces/{uuid4()}/export", headers=auth_headers)
    assert response.status_code == 404


def test_export_workspace_with_no_documents_returns_valid_zip(
    client: TestClient, auth_headers: dict[str, str], test_workspace: str
) -> None:
    """A workspace with zero documents is still a valid export target --
    it should produce a well-formed zip (manifest + empty template CSVs),
    not an error."""
    response = client.get(f"/pipeline/workspaces/{test_workspace}/export", headers=auth_headers)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"

    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert archive.testzip() is None  # no corrupt members
    assert len(archive.namelist()) > 0
