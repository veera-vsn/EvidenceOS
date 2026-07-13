# Phase 1 — Challenges and Resolutions

---

## Challenge #1 — "Server Actions must be async functions"

### Symptom

Navigating to `/dashboard/[workspaceSlug]/documents` produced a Next.js
build error:

```
Error: Server Actions must be async functions.
at documents/actions.ts:30
```

The page never rendered. The TypeScript compiler (`npx tsc --noEmit`) passed
clean, so this was a runtime-level constraint not caught at the type-check stage.

### Root cause

`documents/actions.ts` had `"use server"` at the top. We also exported a
plain synchronous utility function `extensionToDocumentType` from the same
file. Next.js 16 enforces that **every export from a `"use server"` file must
be an `async` function**. The sync export violated this rule.

This constraint exists because Next.js wraps every export in a `"use server"`
file as a callable server action endpoint. Async is required because server
action endpoints are always invoked asynchronously over the network.

### Fix

Moved `extensionToDocumentType` to a new file `document-utils.ts` with no
directive:

```ts
// document-utils.ts — no "use server" directive
export function extensionToDocumentType(filename: string): DocumentType | null { … }
```

Updated the import in `upload-zone.tsx`:

```ts
import { extensionToDocumentType } from "./document-utils";
import { initiateUpload, confirmUpload, failUpload } from "./actions";
```

### Rule to carry forward

Split `"use server"` files strictly: only async server action functions.
Any shared utility (pure functions, type maps, formatters) belongs in a
plain `.ts` file. The three-file pattern that emerged:

- `actions.ts` — `"use server"`, async only
- `document-utils.ts` — no directive, sync helpers
- `upload-zone.tsx` — `"use client"`, consumes both

### Interview lesson

> **Q: What would you do if `tsc --noEmit` passes but the app throws at
> runtime?**

Next.js imposes constraints that TypeScript cannot express in its type
system — for example, "all exports in a `"use server"` file must be async"
is a framework convention, not a type rule. The fix is to understand the
framework's file-level conventions and enforce them structurally (separate
files) rather than fighting them.

---

## Challenge #2 — `NEXT_PUBLIC_*` env vars undefined on client (dynamic bracket access)

### Symptom

Even after restarting the dev server with a clean `.env.local`, the documents
page threw `Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL`
at runtime. Server pages loaded fine; only Client Components failed.

### Root cause

Next.js / Turbopack inlines `NEXT_PUBLIC_*` values at **compile time** using
a static substitution pass. It only recognises the literal dot-notation form:

```ts
process.env.NEXT_PUBLIC_SUPABASE_URL  // ✅ inlined
process.env[name]                     // ❌ dynamic — never inlined
```

The original `requireEnv` helper used `process.env[name]`. Passing
`"NEXT_PUBLIC_SUPABASE_URL"` as a string argument doesn't help — the compiler
can't see through the function call to know the key is a `NEXT_PUBLIC_` var.
At runtime in the browser, `process.env` is a stub and the value is
`undefined`.

### Fix

Split into two helpers: `requirePublicEnv(value, name)` for `NEXT_PUBLIC_*`
vars (the caller does the static access) and `requireEnv(name)` for
server-only secrets (dynamic access is fine on Node.js):

```ts
SUPABASE_URL: requirePublicEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,  // static — inlined by Turbopack
  "NEXT_PUBLIC_SUPABASE_URL",
),
```

### Rule to carry forward

Every `NEXT_PUBLIC_*` read must use a literal property access at the call
site. Never pass the key name into a helper and let the helper do the read.

---

## Challenge #3 — `.env.local` variables not loaded (leading whitespace)

### Symptom

After killing and restarting the dev server, the documents page showed:

```
Runtime Error
Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL.
Did you copy .env.example to .env.local?
```

The app had been working before the restart, and `.env.local` existed on disk.

### Root cause

The `.env.local` file had been written with leading whitespace before each
key name:

```
 NEXT_PUBLIC_SUPABASE_URL=https://…
```

Some `.env` parsers trim leading whitespace from keys; others do not. The
version used by this Next.js build was not trimming them, so
`process.env['NEXT_PUBLIC_SUPABASE_URL']` returned `undefined` while the
actual key in the environment was `' NEXT_PUBLIC_SUPABASE_URL'` (with a
leading space).

### Fix

Rewrote `.env.local` without leading spaces:

```
NEXT_PUBLIC_SUPABASE_URL=https://…
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
```

### Rule to carry forward

Never copy-paste env var blocks from formatted documents or rich-text sources
— they silently introduce invisible whitespace. Always write `.env` files
from scratch or verify with `cat -A .env.local` to see whitespace characters.

---

## Challenge #3 — Storage RLS: path segment parsing

### Symptom

Initial Storage RLS policy attempts used simple `name LIKE '{workspaceId}/%'`
patterns. This required knowing the workspace ID at policy-write time, which
is impossible for a multi-tenant system.

### Root cause

Supabase Storage RLS policies have access to the `name` column (full object
path) and to auth helpers (`auth.uid()`), but no built-in "extract path
segment" function.

### Fix

Used Postgres array functions to parse the path at query time:

```sql
(string_to_array(name, '/'))[1]::uuid
```

`string_to_array` splits the path on `/` and returns a text array. Element
`[1]` (1-indexed) is the first segment — the workspace ID we embedded in the
path. Casting to `uuid` gives a type-safe value that `is_workspace_member()`
can accept.

The full policy:

```sql
create policy "storage_documents_select_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and public.is_workspace_member((string_to_array(name, '/'))[1]::uuid)
);
```

### Rule to carry forward

When designing Storage paths for a multi-tenant system, always embed the
tenant (workspace) ID as the **first path segment**. This makes RLS policies
simple and consistent. The workspace ID must be parseable at RLS evaluation
time — no function calls to other tables.

### Interview lesson

> **Q: How do you enforce multi-tenant isolation in Supabase Storage?**

Embed the tenant ID in the object path and write a Storage RLS policy that
parses it. Supabase's `storage.objects` table exposes the full path as
`name`, so `(string_to_array(name, '/'))[1]::uuid` gives the first segment.
We then call our existing `is_workspace_member()` helper — the same function
that secures table RLS — so the access-control logic is defined once and
reused everywhere.
