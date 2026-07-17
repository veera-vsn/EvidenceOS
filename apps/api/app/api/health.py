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


@router.api_route("/health", methods=["GET", "HEAD"], response_model=HealthResponse)
def health() -> HealthResponse:
    """Return service liveness information.

    This handler does not touch the database or any external service.
    A 200 response only proves that the process is up and reachable.
    Readiness (dependency health) is a separate future endpoint.

    Registered for both GET and HEAD -- uptime monitors (UptimeRobot
    included) commonly probe with HEAD to save bandwidth, and FastAPI/
    Starlette does not auto-add HEAD support to a GET-only route the way
    some other frameworks do. A HEAD-only route would 405 every such
    monitor.
    """
    settings: Settings = get_settings()
    return HealthResponse(
        status="ok",
        env=settings.app_env,
        version=settings.app_version,
        timestamp=datetime.now(UTC),
    )
