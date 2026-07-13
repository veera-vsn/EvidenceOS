# Phase 2 — Challenges and Resolutions

---

## Challenge #1 — `.env` leading whitespace in FastAPI (same root cause as Phase 1)

### Symptom

FastAPI failed to load `SUPABASE_SERVICE_ROLE_KEY` from `.env` — the service
client raised `RuntimeError: SUPABASE_SERVICE_ROLE_KEY not configured`.

### Root cause

Same as Phase 1 Resolution 003: the `.env` file had leading spaces on every
line except the first. `pydantic-settings` uses python-dotenv under the hood,
which does NOT strip leading whitespace from key names.

### Fix

Rewrote `.env` without leading spaces. Added to the team rule: always write
`.env` files from scratch, never copy-paste from formatted documents.

---

## Challenge #2 — ruff BLE001 noqa directive not recognised

### Symptom

`ruff check` failed with:

```
RUF100 Unused `noqa` directive (non-enabled: `BLE001`)
```

The `# noqa: BLE001` comment was added to suppress the "blind exception catch"
warning, but `BLE001` was not in the enabled ruleset in `pyproject.toml`.

### Root cause

The ruff config in `pyproject.toml` only enables specific rule groups (`E`,
`F`, `I`, `N`, `UP`, `B`, `SIM`, `C4`, `RUF`). `BLE` (flake8-blind-except)
is not enabled, so the `noqa` directive for it is considered unused — which
is itself a `RUF100` error.

### Fix

Removed the `# noqa: BLE001` comment. The broad `except Exception` is
intentional (we want to catch and log ALL errors per document without
aborting the run), and since `BLE` is not in our ruleset, ruff won't flag it.

### Rule to carry forward

`# noqa` directives only work for rules that are actually enabled. Check
`pyproject.toml` before adding a noqa comment — suppress the rule or remove
the noqa, never leave an unused one.

---

## Challenge #3 — PyMuPDF import name is `fitz`, not `pymupdf`

### Symptom

`import pymupdf` raised `ModuleNotFoundError`. The package installs as
`pymupdf` but the importable name is `fitz` (the historical MuPDF Python
binding name).

### Fix

```python
import fitz  # PyMuPDF — the package is installed as 'pymupdf', imported as 'fitz'
```

### Rule to carry forward

For PyMuPDF: `pip install pymupdf`, `import fitz`. The two names are
intentionally different for historical reasons (the library predates its
PyPI rename). Always verify import names against the library docs, not the
package name.
