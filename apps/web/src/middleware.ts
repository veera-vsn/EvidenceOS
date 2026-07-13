/**
 * Next.js edge middleware entrypoint.
 *
 * Runs on every request that matches `config.matcher` below. Its only
 * job is to ask `@supabase/ssr` to refresh the JWT if it has expired
 * and to persist any new cookies onto the outgoing response. The
 * authentication decision itself (redirect vs. render) is made in
 * `app/dashboard/layout.tsx`, closer to the data it protects — the
 * middleware just keeps the session warm.
 *
 * Why not check `getUser()` here and redirect?
 *   - The middleware runs on the edge with no shared cache. Every
 *     protected page would still need its own check to be safe, so
 *     duplicating the redirect logic here just adds latency.
 *   - Server Components already have `createClient()` and can render
 *     unauth states inline (e.g. login CTAs). Doing everything in
 *     middleware forces an all-or-nothing binary that we do not want.
 */

import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

/**
 * Skip static assets and image optimisation. Everything else runs
 * through the session refresher — cheap for unauthenticated visitors
 * (no cookies → no work) and essential for signed-in ones.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
