/**
 * Layout for every route under `/dashboard/*`.
 *
 * Any request that reaches a child page is guaranteed to have a
 * signed-in user by the time the page renders — this layout performs
 * the auth check once and redirects anonymous visitors to `/login`.
 *
 * Doing the check here (rather than in middleware) keeps the redirect
 * logic co-located with the data it protects.
 *
 * No chrome rendered here — `/dashboard` (the workspace list) renders
 * its own top bar, and `/dashboard/[workspaceSlug]/*` renders the
 * persistent sidebar from its own layout. Keeping this layout to just
 * the auth guarantee avoids double chrome stacking on workspace pages.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
