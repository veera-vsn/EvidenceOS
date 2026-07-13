# 03 — Supabase Client Wiring

## What we built

Six files that give every execution context in the stack a typed,
cookie-aware Supabase client:

| File | Context | RLS | Cookie access |
|------|---------|-----|---------------|
| `apps/web/src/lib/supabase/client.ts` | Browser (Client Components) | Enforced | `document.cookie` via SDK |
| `apps/web/src/lib/supabase/server.ts` | Server Components, Actions, Route Handlers | Enforced | Next.js `cookies()` |
| `apps/web/src/lib/supabase/middleware.ts` | Edge middleware | Enforced | `NextRequest.cookies` |
| `apps/web/src/lib/supabase/database.types.ts` | Generated — shared by all above | — | — |
| `apps/api/app/core/supabase.py` | FastAPI, anon path | Enforced | JWT via `Authorization` header |
| `apps/api/app/core/supabase.py` | FastAPI, admin path | **Bypassed** | Service-role key |

---

## Why three client flavours on the frontend?

The root cause is that `document.cookie` does not exist on the server and
`NextRequest.cookies` is not the same object as `next/headers` `cookies()`.
Each context has a different cookie API, so `@supabase/ssr` asks you to
wire it yourself via a `cookies: { getAll, setAll }` adapter.

### Browser client (`client.ts`)
```ts
import { createBrowserClient } from "@supabase/ssr";
```
`createBrowserClient` reads and writes `document.cookie` directly.
Use in any Client Component (`"use client"`).

### Server client (`server.ts`)
```ts
import { cookies } from "next/headers";
const cookieStore = await cookies();
```
Next.js 15 made `cookies()` async — it now returns a `ReadonlyRequestCookies`
object scoped to the current request. Server Components can *read* it;
Server Actions and Route Handlers can also *write* it (so a refreshed JWT
persists). The `try/catch` in `setAll` handles the case where a Server
Component tries to write — we swallow the error because the middleware will
refresh on the next mutating request anyway.

### Middleware client (`middleware.ts`)
```ts
request.cookies.getAll();         // read from the incoming request
response.cookies.set(name, ...);  // write onto the outgoing response
```
Middleware runs on the edge before the request is forwarded to the
rendering worker. The cookie API here is `NextRequest`/`NextResponse`,
not `next/headers`. We reconstruct a fresh response after each `setAll` so
the new cookies are attached to the outgoing edge response.

---

## Why is `SUPABASE_URL` now required at boot?

Previously `env.ts` used `optionalEnv("...", "")` — a missing var would
silently produce an empty string and fail later with a cryptic network
error. Now we use `requireEnv`, which throws at import time with a
human-readable message:

```
Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL.
Did you copy .env.example to .env.local?
```

**Interview Q: How do you surface misconfiguration early in a Next.js app?**

Validate required env vars at module load time, not at the call site where
they are used. A thrown error in a top-level module import aborts the dev
server startup with a stack trace that points straight to the missing var.
The alternative — failing silently, then surfacing a 500 three clicks into
the UI — wastes far more time.

---

## The FastAPI side

```python
@lru_cache(maxsize=1)
def get_anon_client() -> Client:
    ...
@lru_cache(maxsize=1)
def get_service_client() -> Client:
    ...
```

`@lru_cache(maxsize=1)` memoises the result on the first call. Supabase's
Python client establishes a connection pool under the hood; recreating it
per request would be expensive and would exhaust file descriptors under
load. The cache is process-scoped, which is correct — the transport is
shared, but JWTs are passed per-request via `postgrest.auth(jwt)`.

**Why two clients?**

The anon client enforces RLS. Every user-facing FastAPI endpoint should use
it, passing the end-user's JWT from the `Authorization` header. The service
client bypasses RLS entirely and is reserved for admin operations
(migrations, audit-trail writes, cross-tenant reports) that the end user
should never trigger directly.

---

## Generated types

```bash
# Regenerate after every SQL migration:
mcp: generate_typescript_types(project_id="skqhmivmnrksypoxnoaq")
# Paste output into:
apps/web/src/lib/supabase/database.types.ts
```

The generated `Database` type flows through every Supabase call:
```ts
createServerClient<Database>(url, key, ...)
supabase.from("workspaces").select(...)  // fully typed return
```

Convenience aliases at the bottom of the file mean page components import
`WorkspaceRow` rather than
`Database["public"]["Tables"]["workspaces"]["Row"]`.
