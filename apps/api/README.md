# EvidenceOS API

FastAPI backend for the EvidenceOS DORA RoI copilot.

## Local dev

```bash
# From this folder:
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate        # macOS / Linux
pip install -r requirements.txt

cp .env.example .env               # then fill in real values

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# → http://127.0.0.1:8000/health
# → http://127.0.0.1:8000/docs (Swagger UI, dev/staging only)
```

## Project layout

```
app/
|-- __init__.py       # package marker + __version__
|-- main.py           # create_app() factory + uvicorn entrypoint
|-- core/
|   |-- config.py     # Settings (pydantic-settings)
|   \-- logging.py    # structlog setup
\-- api/
    \-- health.py     # /health router
```

See [`../../Project_Docs/Learnings/Phase_0_Setup/03_backend_scaffold.md`](../../Project_Docs/Learnings/Phase_0_Setup/03_backend_scaffold.md) for the full walkthrough.

## Tests

```bash
pytest
```

## Lint / format

```bash
ruff check .
ruff format .
```
