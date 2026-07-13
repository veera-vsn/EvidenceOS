# Resolution 003 — .env.local keys not loaded due to leading whitespace

**Date:** 2026-07-13
**Phase:** 1 — Document Upload
**Area:** Environment / Next.js config

---

## Symptom

After restarting the dev server, all pages threw:

```
Runtime Error
Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL.
Did you copy .env.example to .env.local?
```

The `.env.local` file existed and contained the right values. The app
had been working in the previous session.

---

## Root cause

Each line in `.env.local` had one or two leading space characters before
the key name, e.g.:

```
 NEXT_PUBLIC_SUPABASE_URL=https://…
```

The dotenv parser used by this Next.js build did not strip leading
whitespace from key names, so `process.env['NEXT_PUBLIC_SUPABASE_URL']`
returned `undefined`. The key was stored as `' NEXT_PUBLIC_SUPABASE_URL'`
(with a leading space).

---

## Fix

Rewrote `.env.local` with no leading whitespace on any line.

---

## Rule to carry forward

Never copy-paste env var lines from rich-text or formatted sources —
they silently introduce whitespace. When debugging "env var missing"
errors, always inspect the raw file bytes (`cat -A .env.local` on Unix,
or read the file with a tool that shows whitespace) before assuming the
var is genuinely absent.

---

## Interview answer

> `.env` parsing is deceptively fragile. Leading spaces on a key name
> are invisible in most editors but break the parser. The fix is simple
> but the diagnosis requires knowing to look at raw file bytes, not just
> whether the file exists.
