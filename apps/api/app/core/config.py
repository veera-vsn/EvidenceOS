"""Application configuration.

We use pydantic-settings (a Pydantic v2 extension) to load environment
variables into a typed `Settings` object. Advantages over `os.environ`:

    * A missing required var fails at startup, not at first request.
    * Types are validated (bool, int, HttpUrl, list[str], ...).
    * The `Settings` object is a single import surface for the whole app.
    * `.env` files are auto-loaded in dev; env vars win in prod.

We expose a memoised `get_settings()` because instantiating `Settings`
also validates it — we only want to pay that cost once per process.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the API.

    Attributes are populated from environment variables (case-insensitive)
    or from a `.env` file in the working directory.
    """

    # --- App metadata -----------------------------------------------------
    app_name: str = "EvidenceOS API"
    app_version: str = "0.1.0"
    app_env: Literal["local", "development", "staging", "production"] = "local"

    # --- Server -----------------------------------------------------------
    host: str = "0.0.0.0"
    port: int = 8000

    # --- CORS -------------------------------------------------------------
    # Comma-separated origins allowed to call the API. We restrict this
    # tightly in production and only open localhost in dev.
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    # --- Supabase (wired Phase 0.5) --------------------------------------
    supabase_url: str = ""
    supabase_service_role_key: str = ""  # Backend only — bypasses RLS.
    supabase_anon_key: str = ""  # Used for user-scoped calls.

    # --- OpenAI (Phase 3+) ----------------------------------------------
    openai_api_key: str = ""  # Required for field extraction + RAG.

    # --- Langfuse (Phase 3+) — LLM observability -----------------------
    # Keys from https://eu.cloud.langfuse.com (EU region for GDPR).
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://eu.cloud.langfuse.com"

    # --- Pydantic settings config ----------------------------------------
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore unknown env vars — .env is shared with FE.
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide `Settings` singleton.

    Cached with `lru_cache` so the .env file is parsed once, not per
    request. In tests, call `get_settings.cache_clear()` between runs
    if you override env vars.
    """
    return Settings()
