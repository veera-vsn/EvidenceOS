# Resolution 002 — Server Actions build error: non-async export in "use server" file

**Date:** 2026-07-13
**Phase:** 1 — Document Upload
**Area:** Next.js / Server Actions

---

## Symptom

Navigating to `/dashboard/[workspaceSlug]/documents` produced:

```
Error: Server Actions must be async functions.
```

`npx tsc --noEmit` passed clean — this was a framework-level constraint,
not a TypeScript type error.

---

## Root cause

`documents/actions.ts` had `"use server"` at the file level and also
exported `extensionToDocumentType`, a plain synchronous function.

Next.js requires **every export from a `"use server"` file to be an async
function** because it wraps each export as a callable network endpoint.
Sync exports are not allowed.

---

## Fix

1. Created `document-utils.ts` (no directive) with the sync function.
2. Removed the function from `actions.ts`.
3. Updated the import in `upload-zone.tsx` to pull from `document-utils`.

---

## Rule to carry forward

`"use server"` files = async functions only. Sync utilities → plain `.ts`
files. Enforce this structurally by keeping separate files, not by trying
to make helpers async.

---

## Interview answer

> TypeScript can't express "this export must be async" as a type rule.
> Next.js enforces it as a framework invariant. The fix is to understand
> the constraint and structure files accordingly — not fight the framework.
