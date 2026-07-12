# 03 — Backend scaffold walkthrough

Every file inside `apps/api/` explained. Read top-to-bottom.

---

## Directory layout

```
apps/api/
|-- .venv/                # Local virtualenv — git-ignored
|-- app/
|   |-- __init__.py       # Package marker + __version__
|   |-- main.py           # create_app() + uvicorn entrypoint
|   |-- core/
|   |   |-- __init__.py
|   |   |-- config.py     # Settings (pydantic-settings)
|   |   \-- logging.py    # structlog setup
|   \-- api/
|       |-- __init__.py
|       \-- health.py     # /health router
|-- tests/
|   |-- __init__.py
|   \-- test_health.py    # Smoke test
|-- .env.example
|-- pyproject.toml        # ruff + pytest config
|-- README.md
|-- requirements.in       # Human-edited dependency list
\-- requirements.txt      # `pip freeze` output (lockfile)
```

**Why the split between `.in` and `.txt`?**
- `requirements.in` — what we *want* (unpinned or minimally constrained).
- `requirements.txt` — what we *got* (every transitive dep pinned to an exact version).

Regulators and reviewers want reproducibility. When someone clones the repo two years later, `pip install -r requirements.txt` gives them the exact tree we tested with. Meanwhile, `pip install -r requirements.in && pip freeze > requirements.txt` refreshes the lockfile intentionally.

---

## `requirements.in`

Grouped by concern:

| Group | Package | Why |
|---|---|---|
| Web | `fastapi` | Async framework, Pydantic-native, auto OpenAPI |
| Web | `uvicorn[standard]` | ASGI server; `[standard]` adds uvloop + httptools for speed |
| Config | `pydantic>=2` | Data validation (FastAPI depends on this transitively too) |
| Config | `pydantic-settings` | Typed `.env` loading — successor to Pydantic v1's `BaseSettings` |
| HTTP | `httpx` | Async HTTP client — same author as `requests`. Used later for Supabase / LLM calls |
| Logs | `structlog` | Structured JSON logs — required for observability + audit |
| Test | `pytest`, `pytest-asyncio` | Test runner + async test support |
| Lint | `ruff` | Replaces `black` + `isort` + `flake8` with one fast binary |

---

## `app/__init__.py`

Just declares `__version__`. Exposed so `/health` can return it and so tooling has a canonical version to read.

---

## `app/core/config.py` — Settings

The pattern:

```python
class Settings(BaseSettings):
    app_env: Literal["local", "development", "staging", "production"] = "local"
    port: int = 8000
    cors_origins: list[str] = Field(default_factory=lambda: [...])
    supabase_url: str = ""
    ...
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
```

**Three important choices:**

1. `Literal["local", ...]` for `app_env` — catches typos in env files (`APP_ENV=locla` fails at boot, not at first customer bug).
2. `extra="ignore"` — the shared `.env` also contains frontend keys. Rather than error on unknown vars, we skip them.
3. `@lru_cache` on `get_settings()` — validation is not cheap (dotenv parsing, Pydantic model instantiation). We do it once per process.

**Interview Q:** *"Why not a global `settings = Settings()` at module top?"*
**A:** Module-level instantiation runs at import time, which breaks tests that want to override env vars. `get_settings()` is called at request time (via FastAPI's `Depends`) and the cache handles the "once per process" guarantee without freezing test isolation.

---

## `app/core/logging.py` — structlog

```python
def configure_logging(env: str) -> None:
    is_dev = env in {"local", "development"}
    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.format_exc_info,
    ]
    if is_dev:
        processors.append(structlog.dev.ConsoleRenderer(colors=True))
    else:
        processors.append(structlog.processors.JSONRenderer())
    structlog.configure(...)
```

**Why structured logs matter in this product:**

Every request that touches user data must be audit-loggable — DORA and GDPR both require it. Free-form `print(f"user {u} did {x}")` cannot be aggregated, filtered, or queried. `structlog` outputs:

```json
{"event": "recommendation_approved", "user_id": "u_123", "recommendation_id": "r_456", "level": "info", "timestamp": "2026-07-12T09:39:29Z"}
```

Which any log platform (Grafana Loki, Datadog, Elastic) can index by field.

**`contextvars.merge_contextvars`** enables per-request context: if a middleware binds `request_id="..."` at the top of the request, every subsequent log call in that request automatically includes it. Priceless when debugging concurrent traffic.

---

## `app/api/health.py` — health router

```python
class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    env: str
    version: str
    timestamp: datetime

router = APIRouter(tags=["health"])

@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(status="ok", env=settings.app_env, ...)
```

**Design notes:**

- **Pydantic response model** — FastAPI validates the outgoing shape against `HealthResponse` in dev, and generates OpenAPI docs from it automatically.
- **No DB call** — this is the *liveness* check. When we add `/health/ready` (Phase 6), it will ping Supabase to answer "am I ready to serve traffic?" Separating them is a Kubernetes convention that scales to any orchestrator.
- **`Literal["ok", "degraded"]`** — same trick as the config file. Two enum values, no strings.

---

## `app/main.py` — factory + entrypoint

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(get_settings().app_env)
    log.info("starting_api", ...)
    yield
    log.info("stopping_api")

def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=..., docs_url="/docs" if settings.app_env != "production" else None, lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, ...)
    app.include_router(health_router)
    return app

app = create_app()
```

**Three patterns worth memorising:**

1. **`lifespan` async context manager** — the modern replacement for `@app.on_event("startup")` (deprecated in FastAPI 0.109+). Anything you set up before `yield` runs at boot; anything after runs at shutdown. Perfect for opening DB pools and closing them cleanly.
2. **App factory** — `create_app()` returns a fresh instance. Tests use it directly; the module-level `app` alias is only for `uvicorn app.main:app`.
3. **Disable `/docs` in production** — Swagger UI leaks endpoint names to anyone. Fine for dev, off for prod.

---

## `tests/test_health.py`

```python
from fastapi.testclient import TestClient
from app.main import create_app

def test_health_returns_ok() -> None:
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
```

**Why `TestClient` instead of hitting a running server:**
- No sockets, no port collisions, no order dependencies.
- Runs in-process — the `TestClient` calls FastAPI's ASGI callable directly.
- CI-friendly.

---

## `pyproject.toml`

Just tooling config — ruff (linter/formatter) and pytest (test runner).

**Ruff rules enabled:**
- `E, F` — standard errors (pycodestyle + pyflakes).
- `I` — import sorting (replaces isort).
- `N` — naming conventions.
- `UP` — pyupgrade (rewrite `List[str]` → `list[str]` on 3.9+, etc.).
- `B` — flake8-bugbear (catches likely bugs like mutable default args).
- `SIM, C4, RUF` — simplifications and ruff-specific tuning.

**pytest config:** `asyncio_mode = "auto"` means we can write `async def test_...` without decorators. Handy once we have async DB fixtures.

---

## `.env.example`

Same idea as the frontend — a committed template. Values are placeholders. Copy to `.env` locally.

---

## `README.md`

Quick-start command list. If you land in `apps/api/` cold, this is the first thing you read.

---

## Running the backend

```bash
cd apps/api
.venv\Scripts\activate                # Windows
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Verify:
curl http://127.0.0.1:8000/health
# → {"status":"ok","env":"local","version":"0.1.0","timestamp":"..."}
```

Swagger UI: http://127.0.0.1:8000/docs.

---

## What to read next

- `CHALLENGES.md` — problems we hit and solved.
- (Phase 0.5 doc, coming) `04_supabase_setup.md`.
