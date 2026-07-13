"""EvidenceOS API — top-level package marker.

The `app` package hosts all application code. Sub-packages align with
the SDD's module boundaries:
    app.core       - config, logging, cross-cutting concerns
    app.api        - HTTP layer (routers, dependencies)
    app.domain     - business models (Pydantic + dataclasses)
    app.infrastructure - external I/O (Supabase, storage, LLM clients)
    app.workers    - long-running pipeline stages (added Phase 2)
"""

__version__ = "0.1.0"
