/**
 * Supabase client for **Server Components, Server Actions, and Route
 * Handlers**.
 *
 * On the server we cannot read `document.cookie`. Next.js exposes an
 * async `cookies()` helper (Next 15+) that returns a mutable jar for
 * the current request. `@supabase/ssr` bridges the two: the client
 * reads and writes cookies through this jar, so a fresh JWT saved
 * inside a Server Action is visible to the very next Server Component
 * render.
 *
 * When to use:
 *   - Any `async function Page()` / `async function Layout()`.
 *   - Server Actions declared with `"use server"`.
 *   - Route Handlers at `app/**\/route.ts`.
 *
 * When NOT to use:
 *   - Client Components → use `./client.ts`.
 *   - Middleware → use `./middleware.ts` (needs a different cookie API).
 */

import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Build a per-request Supabase client. Must be `await`ed because
 * `cookies()` is async in Next 15+.
 *
 * We deliberately do not cache the client — each request needs its own
 * cookie jar. Creating the client is cheap.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      /**
       * Read every cookie the request sent.
       * `@supabase/ssr` inspects this to find its session cookies.
       */
      getAll() {
        return cookieStore.getAll();
      },

      /**
       * Persist cookies that Supabase wants to set (typically a
       * refreshed JWT). In a pure Server Component context this may
       * throw — Next.js only allows cookie mutations inside Server
       * Actions and Route Handlers. We swallow that error deliberately:
       * the session will still be refreshed on the next mutating call,
       * and the read path continues to work.
       */
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Best-effort: Server Components cannot write cookies.
        }
      },
    },
  });
}
