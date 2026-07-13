/**
 * Supabase session-refresh helper for Next.js middleware.
 *
 * Runs on every request that matches the middleware matcher.
 * Its job is small but essential: touch the Supabase client so that
 * the SDK, on discovering an expired JWT, silently refreshes it and
 * writes the new cookies onto the outgoing response.
 *
 * Without this, an expired session would let the user hit a
 * protected route and only get bounced on the *next* navigation.
 * With this, every request enters the app with a fresh JWT.
 *
 * Called from `src/middleware.ts`.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Refresh (or validate) the Supabase session for the incoming request
 * and return a `NextResponse` with any updated cookies attached.
 *
 * @param request - the incoming Next.js request
 * @returns a response object the middleware should return
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Middleware runs BEFORE the response is streamed, so we can
          // rewrite both the request-side cookies (visible to any
          // downstream Server Component read) and the response-side
          // cookies (which the browser will store).
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Ask the SDK to hydrate the session from the cookies. This triggers
  // an automatic refresh if the JWT has expired. We do not use the
  // return value; the side effect (cookie writes) is what matters.
  await supabase.auth.getUser();

  return response;
}
