# 04 — Auth Pages, Middleware, and the Protected Dashboard

## What we built

| Route | File | Type |
|-------|------|------|
| `/signup` | `app/(auth)/signup/page.tsx` | Server Component |
| `/login` | `app/(auth)/login/page.tsx` | Server Component |
| POST `/signup`, POST `/login`, POST `/logout` | `app/(auth)/actions.ts` | Server Actions |
| `GET /auth/callback` | `app/auth/callback/route.ts` | Route Handler |
| `/dashboard` | `app/dashboard/page.tsx` | Server Component |
| `/dashboard` (auth gate) | `app/dashboard/layout.tsx` | Server Component |
| `/dashboard` (workspace create) | `app/dashboard/actions.ts` | Server Action |
| All routes | `middleware.ts` | Next.js Edge Middleware |

---

## The auth flow, step by step

```
User fills /signup form
      │
      ▼ (Server Action: signup)
supabase.auth.signUp({ email, password, emailRedirectTo: "/auth/callback" })
      │
      ▼
Supabase sends confirmation email → redirect to /login?notice=check-email
      │
      ▼ (user clicks email link)
GET /auth/callback?code=<one-time-code>
      │
      ▼ (Route Handler: exchangeCodeForSession)
Supabase exchanges code → sets session cookies
      │
      ▼ redirect /dashboard
dashboard/layout.tsx: supabase.auth.getUser() → user exists → render
      │
      ▼
dashboard/page.tsx: supabase.from("workspaces").select(...) via RLS
```

---

## Why Server Actions, not client-side `supabase.auth.*`?

The most common alternative is a Client Component that calls
`supabase.auth.signInWithPassword` in an `onClick` handler. This works, but
has a subtle problem: the session cookies Supabase sets from the browser are
`SameSite=Lax`, readable by JavaScript. Server Actions write cookies
server-side where you can set `HttpOnly`, which prevents XSS from stealing
the session token.

Additionally, Server Actions mean the auth forms are *pure HTML forms* — they
work with JavaScript disabled. That is not a real use case for a SaaS, but
the pattern signals cleaner architecture.

**Interview Q: Why do you use Server Actions for auth instead of the
Supabase JS client in the browser?**

Two reasons. First, `HttpOnly` cookies cannot be read by JavaScript, so even
a successful XSS attack cannot steal the session token. Second, the form
submission path ships zero client-side JavaScript for the happy path, which
eliminates the hydration window where form events fire before React has
initialised.

---

## Error handling: `?error=` searchParams vs `useFormState`

We redirect on error rather than returning an error object from the action:
```ts
redirect(`/login?error=${encodeURIComponent(error.message)}`);
```

This keeps the pages as pure Server Components — no `"use client"` directive,
no `useActionState`, no hydration cost. The trade-off: errors are visible in
the URL bar. For auth error messages that is fine (they contain nothing
sensitive). For a payment form you would want `useActionState` to avoid
leaking card-adjacent context into browser history.

---

## Terms of Service / Privacy Policy consent gate

Phase 12 added the `/terms` and `/privacy` pages (see
`Phase_12_Encryption/01_overview.md`), but shipped them as standalone
routes with nothing on `/signup` actually requiring the user to agree to
either before an account was created — a real gap, found and closed in a
later pass, not part of the original Phase 12 change.

The fix is a `required` checkbox on the signup form, linking to both
pages, enforced in two places:

```tsx
// app/(auth)/signup/page.tsx
<input type="checkbox" name="accepted_terms" required ... />
```

```ts
// app/(auth)/actions.ts — signup()
if (formData.get("accepted_terms") !== "on") {
  redirect(`/signup?error=${encodeURIComponent(
    "You must agree to the Terms of Service and Privacy Policy to create an account.",
  )}`);
}
```

The HTML `required` attribute is a UX nicety, not the actual gate — it's
trivial to bypass (disable JS, `curl` the Server Action directly), so the
same check is repeated server-side before `supabase.auth.signUp()` is
ever called. Same "don't trust the client" principle as `requireField()`
a few lines below it in the same file.

---

## Middleware: session refresh, not redirect

`src/middleware.ts` calls `updateSession(request)` on every non-static
request. It does **not** check `getUser()` and redirect to `/login`. The
redirect decision sits in `app/dashboard/layout.tsx` instead.

Why keep them separate?

1. **Correctness**: Middleware runs before the Next.js router and has no
   knowledge of which routes are "protected". If we added middleware-level
   redirects we would need to keep a second list of protected paths in sync
   with the route tree — a maintenance hazard.
2. **Simplicity**: `updateSession` is one line. The layout check is also one
   call to `getUser()`. Both are fast because the Supabase SDK caches the
   decoded JWT and only hits the Auth endpoint when the token has actually
   expired.
3. **Flexibility**: Some "protected" routes should render a different UI
   for logged-out users (e.g. a marketing page that personalises itself if
   you happen to be signed in) rather than hard-redirect. A middleware
   redirect cannot express that; a layout check can.

---

## `/auth/callback` — the code exchange Route Handler

This is **not** a page — it performs a side effect (cookie write) and
immediately redirects. Route Handlers are the right tool because:

- They can write cookies. Server Components cannot.
- They return raw `Response` / `NextResponse` objects, so a redirect is
  just `NextResponse.redirect(...)` — no page renders.

```ts
const { error } = await supabase.auth.exchangeCodeForSession(code);
if (error) redirect(`/login?error=...`);
redirect(next ?? "/dashboard");
```

The `next` query parameter lets us build a "redirect after login" flow later
without changing the callback handler — Supabase just needs to be told what
`emailRedirectTo` to use.

---

## Dashboard auth gate

```ts
// app/dashboard/layout.tsx
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
```

This pattern is the Next.js equivalent of a route guard. The layout wraps
every child page, so adding a new page under `/dashboard/` is automatically
protected without extra boilerplate.

**Interview Q: What prevents a user from accessing `/dashboard` without
logging in?**

The `app/dashboard/layout.tsx` calls `supabase.auth.getUser()` on the server.
`getUser()` makes a network call to Supabase's Auth endpoint, validating the
JWT signature and expiry server-side — it is not a mere cookie parse. If the
call returns `null`, we `redirect("/login")` before any page-specific code
runs. Because this sits in the layout, every route under `/dashboard/` is
covered by a single check.

---

## Workspace creation and RLS

```ts
// dashboard/actions.ts
const { error } = await supabase.from("workspaces").insert({
  name,
  slug: slugify(name),
  created_by: user.id,
});
```

The server client's JWT is the user's own — so Supabase RLS applies the
`workspaces_insert` policy:
```sql
CREATE POLICY workspaces_insert ON public.workspaces
  FOR INSERT WITH CHECK (created_by = auth.uid());
```

If someone crafted a request with a different `created_by` value, Postgres
would reject it. The trigger then fires automatically to add the creator
as `owner` in `workspace_members`. From the action's perspective it is a
single `INSERT`; the membership is a database concern, not an application one.
