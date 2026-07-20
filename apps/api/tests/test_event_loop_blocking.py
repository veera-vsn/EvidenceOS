"""Regression test for the 2026-07-20 audit fix (B2): async route
handlers must not block the shared event loop on synchronous Supabase
I/O.

The rest of the suite proves each route still returns the right status
code with `anyio.to_thread.run_sync` in place -- it says nothing about
whether the event loop itself stayed responsive while a slow call was
in flight, which is the actual thing B2 (and this fix) is about. A
green suite here would look identical whether the offload actually
worked or was a no-op typo, the same category of gap that let the
rate-limit scope bug in test_pipeline_router.py slip past a first,
passing version of that test too. This test fires a deliberately slow
request and a concurrent /health request on the same event loop and
asserts /health isn't held up behind it.

Needs a real ASGI event loop (not the sync TestClient used elsewhere in
this suite), so this uses httpx.AsyncClient directly against the app.
"""

from __future__ import annotations

import asyncio
import time
from unittest.mock import patch
from uuid import uuid4

import httpx

from app.core.config import get_settings
from app.main import create_app
from app.pipeline import router as pipeline_router

SLOW_CALL_SECONDS = 0.5


def _slow_fetch_run_status(run_id: str) -> str | None:
    """Stands in for a slow Supabase network round-trip."""
    time.sleep(SLOW_CALL_SECONDS)
    return None


async def test_slow_trigger_lookup_does_not_block_concurrent_health_check() -> None:
    app = create_app()
    headers = {"x-internal-api-key": get_settings().internal_api_secret}

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        with patch.object(pipeline_router, "_fetch_run_status", _slow_fetch_run_status):
            health_start = time.monotonic()
            trigger_task = asyncio.create_task(
                client.post(f"/pipeline/runs/{uuid4()}/trigger", headers=headers)
            )
            # `asyncio.create_task` only *schedules* the coroutine -- it
            # doesn't start running until something yields. httpx's
            # ASGITransport calls the app in-process with no real socket
            # I/O, so a bare `await client.get("/health")` next can run
            # start-to-finish without ever ceding control back to the
            # scheduler, meaning trigger_task would never get a chance to
            # run (and block anything) *during* the health call -- a first
            # version of this test measured exactly that and passed
            # unconditionally, fixed or not, which is worse than no test.
            # One explicit `sleep(0)` forces a real scheduler handoff, so
            # if trigger_task's blocking call isn't actually offloaded,
            # its freeze happens here and shows up in health_elapsed;
            # confirmed by temporarily reverting the fix and rerunning
            # this test (it failed at ~0.5s, as expected) before landing.
            await asyncio.sleep(0)
            health_response = await client.get("/health")
            health_elapsed = time.monotonic() - health_start

            trigger_response = await trigger_task

    assert health_response.status_code == 200
    # If the blocking call were still inline (not offloaded via
    # run_sync), /health would queue behind it on the single event loop
    # and take roughly SLOW_CALL_SECONDS too. Comfortably under half of
    # that is a clear pass/fail signal either way.
    assert health_elapsed < SLOW_CALL_SECONDS / 2

    assert trigger_response.status_code == 404  # _slow_fetch_run_status returns None
