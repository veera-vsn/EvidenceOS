# Resolution 004 — NEXT_PUBLIC_ env vars undefined on client due to dynamic bracket access

**Date:** 2026-07-13
**Phase:** 1 — Document Upload
**Area:** Next.js / Turbopack / Environment

---

## Symptom

Even after restarting the dev server with a clean `.env.local`, the documents
page threw at runtime:

```
Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL.
```

The error originated in `env.ts → client.ts → upload-zone.tsx` — a Client
Component. The server-side Supabase client worked fine; only the browser-side
client failed.

---

## Root cause

Next.js / Turbopack replaces `NEXT_PUBLIC_*` variables at **compile time**
using a static text-substitution pass. It only recognises the **literal
dot-notation form**:

```ts
process.env.NEXT_PUBLIC_SUPABASE_URL   // ✅ inlined at compile time
```

Dynamic bracket access with a variable key is invisible to the compiler:

```ts
function requireEnv(name: string) {
  const value = process.env[name];   // ❌ NOT inlined — undefined in browser
}
requireEnv("NEXT_PUBLIC_SUPABASE_URL");
```

At runtime in the browser, `process.env` is a stub object containing only
the values that were inlined. Everything else is `undefined`.

The original `requireEnv` helper used `process.env[name]` — correct for
server-only secrets where Node.js resolves the full env at runtime, but
broken for client-visible `NEXT_PUBLIC_*` vars.

---

## Fix

Split the helper into two patterns:

```ts
// For NEXT_PUBLIC_ vars — validate an already-resolved value
function requirePublicEnv(value: string | undefined, name: string): string { … }

// Usage — static access happens at the call site, not inside the helper
SUPABASE_URL: requirePublicEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,  // static literal — compiler inlines this
  "NEXT_PUBLIC_SUPABASE_URL",
),

// For server-only secrets — dynamic access is fine (Node.js resolves at runtime)
export function requireEnv(name: string): string {
  const value = process.env[name];  // still works server-side
  …
}
```

---

## Rule to carry forward

**All `NEXT_PUBLIC_*` reads must use literal dot-notation at the call site.**
Pass the already-resolved value into any validation helper — never the key
name. Dynamic access (`process.env[variable]`) is server-only.

---

## Interview answer

> Next.js inlines `NEXT_PUBLIC_*` vars via a static AST/text pass at build
> time. It can only substitute `process.env.NEXT_PUBLIC_FOO` — a literal.
> Dynamic keys defeat the substitution. In the browser, `process.env` is just
> a stub, so dynamic access returns `undefined`. The fix: always read
> `NEXT_PUBLIC_*` vars with the literal property name, then pass the resolved
> string value into any validator.
