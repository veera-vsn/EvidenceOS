"use server";

/**
 * Dashboard-scoped Server Actions.
 *
 * Currently: create the caller's first workspace. The `workspaces`
 * INSERT policy checks `created_by = auth.uid()`, and a trigger
 * auto-adds the creator as an `owner` in `workspace_members` — so this
 * action just has to insert the row.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Convert an organisation name into a URL-safe slug. Not
 * globally-unique on its own — we retry with a numeric suffix on the
 * (rare) collision, but for the walking skeleton a single attempt is
 * fine.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

export async function createWorkspace(formData: FormData) {
  const rawName = formData.get("name");
  const name =
    typeof rawName === "string" && rawName.trim() !== ""
      ? rawName.trim()
      : null;

  if (!name) {
    redirect("/dashboard?error=name-required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already redirected anonymous visitors, but re-check here so
  // TypeScript narrows and we never call `.insert` with a null user.
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("workspaces").insert({
    name,
    slug: slugify(name),
    created_by: user.id,
  });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
