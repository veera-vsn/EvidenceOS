"""Shared-secret authentication for internal (Next.js -> FastAPI) calls.

Every /pipeline/* route previously trusted "only our own Next.js server
calls this" as an unenforced assumption -- the code's own docstrings said
so plainly, but nothing actually checked it. The backend's nginx/EC2 box
terminates TLS for anyone on the public internet, not just Vercel (see
Project_Docs/Learnings/Phase_7_Deployment/01_aws_setup_log.md SS5), so a
caller with a leaked workspace/document UUID could hit these routes
directly with no login at all -- flagged as a critical finding in the
2026-07-18 production audit (Project_Docs/AUDIT_2026-07-18.md, S1).

This makes that assumption an actual, checked control: every server-side
fetch from apps/web attaches a shared-secret header
(apps/web/src/lib/api.ts's `internalApiHeaders()`), and every /pipeline
route now requires it via this dependency.

Not a replacement for real per-user auth -- it only proves "this request
came from our own Next.js server," not "this user may access this
workspace." Per-workspace authorization still happens in Next.js (see
export/download/route.ts's own trust-boundary comment) before it ever
calls here. Closing that gap fully (e.g. forwarding the user's Supabase
JWT so FastAPI can re-verify membership itself) is future hardening, not
done in this pass -- see AUDIT_2026-07-18.md's Action Plan.
"""

from __future__ import annotations

import secrets

from fastapi import Header, HTTPException

from app.core.config import get_settings


def require_internal_api_key(x_internal_api_key: str | None = Header(default=None)) -> None:
    """FastAPI dependency: reject the request unless it carries the
    correct shared secret.

    Uses `secrets.compare_digest` (constant-time) rather than `==` so a
    timing attack can't be used to guess the key byte-by-byte from
    response latency.
    """
    settings = get_settings()
    if not x_internal_api_key or not secrets.compare_digest(
        x_internal_api_key, settings.internal_api_secret
    ):
        raise HTTPException(status_code=401, detail="Missing or invalid internal API key.")
