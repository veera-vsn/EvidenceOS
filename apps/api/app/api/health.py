"""`/health` — liveness endpoint.

Returned by load balancers, k8s probes, uptime monitors, and the
frontend landing page. Must:

    * Respond quickly (< 100 ms) — no DB round-trip in the base check.
    * Return machine-parseable JSON so monitors can key on `status`.
    * Include a version + env tag so a deployed instance is identifiable.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import Settings, get_settings


class HealthResponse(BaseModel):
    """Shape returned by `GET /health`.

    Kept intentionally small — deep dependency checks (Supabase, LLM)
    live at `/health/ready` in a later phase.
    """

    status: Literal["ok", "degraded"]
    env: str
    version: str
    timestamp: datetime


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Return service liveness information.

    This handler does not touch the database or any external service.
    A 200 response only proves that the process is up and reachable.
    Readiness (dependency health) is a separate future endpoint.
    """
    settings: Settings = get_settings()
    return HealthResponse(
        status="ok",
        env=settings.app_env,
        version=settings.app_version,
        timestamp=datetime.now(UTC),
    )
