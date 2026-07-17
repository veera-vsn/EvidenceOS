"use server";

/**
 * Server Actions for the auth pages.
 *
 * Why Server Actions instead of client-side `supabase.auth.*` calls?
 *   - Cookies for the session are HTTP-only. A Server Action can write
 *     them; browser JavaScript cannot. This makes the login path more
 *     secure and simplifies the client (plain HTML forms).
 *   - Errors surface via `?error=` on redirect, so pages stay pure
 *     Server Components. No `useState`, no `useEffect`, no hydration
 *     penalty on the auth screens.
 *
 * On success we `redirect()` — Next.js throws internally to break out
 * of the action, so nothing after that call runs.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

/**
 * Extract a required string from FormData or bail with a redirect back
 * to the referring page. Keeps validation logic out of every action.
 */
function requireField(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing field: ${name}`);
  }
  return value.trim();
}

/**
 * Compute the absolute URL to send in the confirmation email. Supabase
 * will append `?code=...` and the user's browser will land on
 * `/auth/callback`, where we exchange the code for a session.
 */
async function getSiteOrigin(): Promise<string> {
  const hdrs = await headers();
  const forwardedHost = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  if (forwardedHost) return `${proto}://${forwardedHost}`;
  // Fallback for local dev where headers are sometimes missing.
  return "http://localhost:3000";
}

export async function signup(formData: FormData) {
  const email = requireField(formData, "email");
  const password = requireField(formData, "password");
  const displayName = formData.get("display_name");

  if (formData.get("accepted_terms") !== "on") {
    redirect(
      `/signup?error=${encodeURIComponent(
        "You must agree to the Terms of Service and Privacy Policy to create an account.",
      )}`,
    );
  }

  const supabase = await createClient();
  const origin = await getSiteOrigin();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        display_name:
          typeof displayName === "string" && displayName.trim() !== ""
            ? displayName.trim()
            : null,
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // Supabase defaults require email confirmation. Send the user to a
  // "check your inbox" state on the login page.
  redirect("/login?notice=check-email");
}

export async function login(formData: FormData) {
  const email = requireField(formData, "email");
  const password = requireField(formData, "password");

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
