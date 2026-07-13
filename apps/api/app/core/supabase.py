"""Supabase client factory for the FastAPI backend.

Two client flavours are exposed:

* :func:`get_anon_client` — talks to Supabase using the public anon key.
  Every query is subject to Row-Level Security. Use this for anything
  that acts on behalf of a specific end-user; pass the user's JWT
  through :meth:`postgrest.set_auth` so RLS knows who is asking.

* :func:`get_service_client` — talks to Supabase using the service-role
  key. **Bypasses RLS entirely.** Use only for cross-tenant admin
  paths, migrations, or scheduled jobs — never in a request handler
  that is about to render tenant-scoped data, or you defeat the whole
  point of RLS.

Both factories are memoised with :func:`functools.lru_cache` so we
avoid re-establishing the underlying transport per request.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_anon_client() -> Client:
    """Return the process-wide anon-key Supabase client.

    RLS is enforced. Call ``client.postgrest.auth(user_jwt)`` before
    running a query on behalf of a signed-in user.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError(
            "Supabase anon client requested but SUPABASE_URL / SUPABASE_ANON_KEY "
            "are not configured. Did you copy .env.example to .env?"
        )
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache(maxsize=1)
def get_service_client() -> Client:
    """Return the process-wide service-role Supabase client.

    RLS is bypassed. Reserve for admin paths and audit trails.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "Supabase service client requested but SUPABASE_URL / "
            "SUPABASE_SERVICE_ROLE_KEY are not configured."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
