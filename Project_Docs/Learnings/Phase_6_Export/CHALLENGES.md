# Phase 6 — Challenges

## C1: `.single()` turns "not found" into a 500 instead of a 404

**What happened:** Testing the export endpoint against a deliberately
invalid workspace ID (the tenant-isolation sanity check in the
verification plan) returned `500 Internal Server Error` instead of the
expected `404`. The backend log showed:

```
postgrest.exceptions.APIError: {'message': 'Cannot coerce the result to
a single JSON object', 'code': 'PGRST116', 'hint': None, 'details': 'The
result contains 0 rows'}
```

**Root cause:** `build_export_zip()` looked up the workspace with:

```python
ws_resp = client.table("workspaces").select("id, name").eq("id", workspace_id).single().execute()
if not ws_resp.data:
    raise ValueError(...)
```

`postgrest-py`'s `.single()` doesn't return `data=None` for zero
matching rows the way a plain `.select()` would — it raises `APIError`
(`PGRST116`) *inside* `.execute()`. The `if not ws_resp.data` check on
the next line was dead code; the exception fired before it could ever
run, and FastAPI's default handler turned the uncaught `APIError` into a
500.

**Fix:** Switched to `.maybe_single()`, which is built for exactly this —
returns `None`/`data=None` for zero rows instead of raising:

```python
ws_resp = (
    client.table("workspaces").select("id, name").eq("id", workspace_id)
    .maybe_single().execute()
)
if not ws_resp or not ws_resp.data:
    raise ValueError(...)
```

**Why it matters:** The happy path (a real, existing workspace) worked
correctly through every earlier test — pytest, `curl` against the real
workspace ID, a full browser download and manual zip inspection all
passed before this bug was found. It only surfaced on the *unhappy* path,
which nothing in the automated suite exercised (no test constructs a
missing-workspace scenario against the live DB-touching function, per the
project's convention of not mocking Supabase). This is exactly why the
verification plan's tenant-isolation check existed — it wasn't testing
tenant isolation successfully, but it caught a different, real bug by
poking at an edge the happy-path testing never reached.

**Interview lesson:** `.single()` and `.maybe_single()` are not
interchangeable "convenience" methods — `.single()` is an assertion
("I expect exactly one row; error loudly if that's false"), appropriate
when a missing row is a bug. `.maybe_single()` is a lookup ("there may or
may not be a row"), appropriate when absence is a valid, expected
outcome your code needs to branch on — exactly the shape of "does this
workspace ID exist." Reach for `.single()` only when zero rows would
itself indicate something has gone wrong elsewhere in the system.

---

## C2: `uvicorn --reload` silently served stale code for the entire session

**What happened:** After adding the export endpoint, `/openapi.json`
against the running dev server kept showing only the pre-Phase-6 routes,
across multiple full process restarts, a `__pycache__` wipe, and killing
every process whose command line matched `uvicorn`. A `TestClient`
built by importing `app.main.create_app()` fresh in a one-off script
showed all four routes correctly every time — proving the *code* was
right. The discrepancy was isolated by running plain `uvicorn
app.main:app` **without** `--reload` on a scratch port: it showed the
correct routes on the very first try.

**Root cause:** `uvicorn --reload` uses WatchFiles to watch the source
tree and spawn a fresh worker subprocess when it detects a change.
Something in how that reload/respawn cycle interacts with this specific
Windows environment was not reliably picking up edits to
`app/pipeline/router.py` and the new `app/pipeline/export.py` — the
worker process the reloader spawned kept running against an outdated
import of the module. Log output showed no error and no obvious sign
anything was wrong; the reloader reported "Application startup
complete" as if everything were normal.

**This also retroactively explains Phase 5's CHALLENGES.md C2**, which
attributed a very similar symptom (a new endpoint 404ing despite correct
code) to an orphaned process holding the port. That was *a* contributing
factor in that instance, but this session's more careful isolation
(bypassing `--reload` entirely) shows the deeper, more general cause:
`--reload` itself is not trustworthy for backend changes on this
machine, independent of whether stale processes are also present.

**Fix — for the rest of this session, and recommended going forward on
this machine:** run the dev backend as plain `uvicorn app.main:app
--port 8000` (no `--reload`), and restart it manually after backend
changes. Slower feedback loop than `--reload` promises, but correct
every time, which a fast-but-wrong loop is not.

**Interview lesson:** A file-watcher that reports success while serving
stale code is worse than no watcher at all — silent staleness costs far
more debugging time than an explicit "restart me" step would. When a
"the code is definitely right but the server disagrees" symptom shows
up, isolate the *serving* layer from the *code* layer independently (a
fresh one-off process/script importing the same code) before assuming
the bug is in your source — here it very much wasn't.

---

## C3: A ghost listener on port 8000 that Windows itself can't resolve

**What happened:** Mid-session, port 8000 became permanently unbindable
(`WinError 10048`), and stayed that way through multiple minutes,
multiple wait-and-retry cycles, and every process-killing technique
available inside this environment. `Get-NetTCPConnection -LocalPort
8000` consistently reported a PID (e.g. `31572`) as the `Listen` owner —
but `Get-Process -Id 31572` and `taskkill /PID 31572` both reported no
such process exists. The socket was demonstrably real (`bind()` genuinely
failed against it) but its owning process was not enumerable by any tool
available in this shell.

**Workaround, not a fix:** The dev backend was run on port `8010`
instead, with `apps/web/.env.local`'s `NEXT_PUBLIC_API_BASE_URL`
temporarily pointed at it for the rest of the verification pass, then
left there rather than reverted to a `:8000` value that would silently
stop working. Port 8000 itself was never reclaimed within this session.

**Why it matters / what to do about it:** This is very likely specific
to this sandboxed execution environment rather than a normal Windows
networking failure mode — a process holding a listening socket that
doesn't appear in the same session's process table smells like a
sandbox/session boundary, not an application bug. A full machine restart
(or, short of that, checking Task Manager's "Details" tab with "Show
processes from all users" for a `python.exe`/`uvicorn` entry outside
this tool's visibility) is the most likely way to actually clear it.
`apps/web/.env.local` currently points at `:8010`, not the project's
documented `:8000` default — **anyone resuming local development on this
machine should check that file** and either restart the machine and
revert it, or keep using `:8010` if `:8000` still won't bind.

**Interview lesson:** Not every "impossible" state is a bug in your own
code — when the operating system's own tools contradict each other
(the network stack says a PID owns a socket; the process table says that
PID doesn't exist), that's a signal to stop debugging the application
and work around the environment instead. Recognising *when* to stop
digging and switch to a workaround is as much a skill as the digging
itself; several minutes were spent here trying increasingly forceful kill
techniques before making that call.
