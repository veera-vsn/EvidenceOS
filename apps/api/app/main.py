"""FastAPI application entry point.

Run locally with:

    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

The `create_app()` factory pattern makes the app testable (tests can
call `create_app()` with overridden settings) and keeps import-time
side effects to a minimum.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app import __version__
from app.api.health import router as health_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.core.rate_limit import limiter
from app.pipeline.router import router as pipeline_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Async lifespan hook — runs once on startup and once on shutdown.

    Startup: initialise loggers and log a banner.
    Shutdown: log a goodbye (later, close DB pools + HTTP clients).
    """
    settings = get_settings()
    configure_logging(settings.app_env)
    log = get_logger("app.startup")
    log.info(
        "starting_api",
        env=settings.app_env,
        version=settings.app_version,
        cors_origins=settings.cors_origins,
    )
    try:
        yield
    finally:
        log.info("stopping_api")


def create_app() -> FastAPI:
    """Application factory.

    Kept as a function (not a top-level `app = FastAPI()`) so that tests
    can build fresh instances with different settings. `main:app` is a
    thin alias for uvicorn's convenience.
    """
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Backend for EvidenceOS — an AI-powered DORA Register of "
            "Information (RoI) evidence & validation copilot."
        ),
        # Only expose docs outside production.
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # CORS — the frontend runs on a different origin in local dev.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Rate limiting — see app/core/rate_limit.py. Applied per-route via
    # @limiter.limit(...) (currently just the LLM-billed trigger
    # endpoint); this registers the limiter + its 429 error handler.
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Routers — mount here as they are added.
    app.include_router(health_router)
    app.include_router(pipeline_router)

    return app


# Uvicorn entry point. `app.main:app` is the target you pass on the CLI.
app: FastAPI = create_app()

# Sanity check for tooling that imports the module: expose the version.
__all__ = ["__version__", "app", "create_app"]
