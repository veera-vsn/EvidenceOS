/**
 * Supabase client for **browser / Client Components**.
 *
 * When to use:
 *   - Inside `"use client"` components that need to react to auth state.
 *   - For real-time subscriptions and optimistic UI.
 *
 * When NOT to use:
 *   - Inside Server Components → use `./server.ts` instead.
 *   - Inside Server Actions or Route Handlers → use `./server.ts`.
 *   - Inside middleware → use `./middleware.ts` (special cookie plumbing).
 *
 * Cookies are read from `document.cookie`; the browser and the server
 * agree on the same session because `@supabase/ssr` writes an httpOnly
 * cookie that both can see.
 */

import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Instantiate a browser-side Supabase client typed against our schema.
 *
 * Called at render time by Client Components. The underlying client is
 * cheap to create (no network), so we do not memoise; if that becomes a
 * bottleneck we can switch to a module-level singleton later.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
  );
}
