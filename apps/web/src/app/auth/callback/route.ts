/**
 * `/auth/callback` — Route Handler for email confirmation and OAuth.
 *
 * Supabase appends `?code=<one-time>` to the redirect URL it embeds in
 * confirmation emails. Exchanging that code sets the session cookies,
 * after which the user has a real JWT and can hit protected routes.
 *
 * We deliberately implement this as a Route Handler (not a page): the
 * URL should not render a UI, it should perform side effects (cookie
 * writes) and redirect. Route Handlers can mutate cookies in ways
 * Server Components cannot.
 */

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  // Missing code → the link is malformed or already used. Send the
  // user to login with a friendly notice rather than a 400.
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing-code", url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url),
    );
  }

  // Use `origin` so relative `next` values like `/dashboard` resolve
  // against the current host, not the confirmation email's host.
  return NextResponse.redirect(new URL(next, url.origin));
}
