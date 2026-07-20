"use server";

/**
 * Blog newsletter capture. Public Server Action -- no auth required,
 * matches the anon-insert-only RLS policy on newsletter_subscribers
 * (see supabase/migrations/0012_newsletter_subscribers.sql).
 */

import { createClient } from "@/lib/supabase/server";

export async function subscribeToNewsletter(
  _prevState: { error: string | null; success: boolean },
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("newsletter_subscribers").insert({ email });

  if (error) {
    // Unique violation -- already subscribed. Treat as success from the
    // reader's point of view; they don't need to know they'd already
    // signed up, and there's nothing actionable for them to do about it.
    if (error.code === "23505") {
      return { error: null, success: true };
    }
    return { error: "Something went wrong. Please try again.", success: false };
  }

  return { error: null, success: true };
}
