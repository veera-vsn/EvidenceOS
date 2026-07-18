"""Shared pytest fixtures for FastAPI route integration tests.

Before this file, the /pipeline/* routes (trigger, revalidate, export)
had zero test coverage of any kind -- only the pure functions underneath
them were unit-tested (see test_export.py's and test_entity_export.py's
own docstrings, and Project_Docs/AUDIT_2026-07-18.md's Testing Audit).
These fixtures create real rows in a real database and exercise the
actual HTTP layer via FastAPI's TestClient, rather than mocking the
Supabase client -- the local Docker-based Supabase stack this project
now runs (see
Project_Docs/Learnings/Phase_7_Deployment/03_operations_runbook.md)
makes that practical for the first time; `npx supabase start` must be
running before these tests execute, same as local dev.

Every fixture cleans up after itself so the suite is repeatable.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.supabase import get_service_client
from app.main import create_app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(create_app())


@pytest.fixture()
def auth_headers() -> dict[str, str]:
    """The shared-secret header every /pipeline/* route now requires
    (2026-07-18 production audit fix, S1) -- see app/core/internal_auth.py.
    """
    return {"x-internal-api-key": get_settings().internal_api_secret}


@pytest.fixture()
def test_user() -> Iterator[str]:
    """A throwaway auth.users row -- every FK in this schema chains back
    to one (workspaces.created_by, documents.created_by, ...), and
    that's not optional the way it might be in a less strictly-typed
    schema."""
    sb = get_service_client()
    email = f"pytest-{uuid.uuid4().hex[:12]}@example.eu"
    resp = sb.auth.admin.create_user(
        {"email": email, "password": "pytest-not-a-real-password", "email_confirm": True}
    )
    user_id = resp.user.id
    yield user_id
    sb.auth.admin.delete_user(user_id)


@pytest.fixture()
def test_workspace(test_user: str) -> Iterator[str]:
    sb = get_service_client()
    slug = f"pytest-{uuid.uuid4().hex[:12]}"
    resp = (
        sb.table("workspaces")
        .insert({"name": "Pytest Workspace", "slug": slug, "created_by": test_user})
        .execute()
    )
    workspace_id = resp.data[0]["id"]
    yield workspace_id
    sb.table("workspaces").delete().eq("id", workspace_id).execute()


@pytest.fixture()
def test_document_version(test_user: str, test_workspace: str) -> Iterator[str]:
    """A document + document_version pair, uploaded_status='uploaded'.
    No extraction_results/field_reviews rows -- tests that need those
    insert them directly; revalidate's own logic handles an empty
    extraction/review set as "nothing extracted yet," not an error."""
    sb = get_service_client()
    doc_resp = (
        sb.table("documents")
        .insert(
            {
                "workspace_id": test_workspace,
                "name": "pytest-fixture.pdf",
                "file_type": "pdf",
                "created_by": test_user,
            }
        )
        .execute()
    )
    document_id = doc_resp.data[0]["id"]

    version_resp = (
        sb.table("document_versions")
        .insert(
            {
                "document_id": document_id,
                "version_number": 1,
                "storage_path": f"{test_workspace}/{document_id}/1/pytest-fixture.pdf",
                "uploaded_by": test_user,
                "upload_status": "uploaded",
            }
        )
        .execute()
    )
    version_id = version_resp.data[0]["id"]
    yield version_id
    # documents delete cascades to document_versions and everything
    # chained off it (extraction_results, validation_results,
    # field_reviews) -- no separate cleanup needed for those.
    sb.table("documents").delete().eq("id", document_id).execute()


@pytest.fixture()
def test_pipeline_run(test_user: str, test_workspace: str) -> Iterator[str]:
    sb = get_service_client()
    resp = (
        sb.table("pipeline_runs")
        .insert({"workspace_id": test_workspace, "created_by": test_user, "status": "queued"})
        .execute()
    )
    run_id = resp.data[0]["id"]
    yield run_id
    sb.table("pipeline_runs").delete().eq("id", run_id).execute()
