/**
 * Layout for every route under `/dashboard/*`.
 *
 * Any request that reaches a child page is guaranteed to have a
 * signed-in user by the time the page renders — this layout performs
 * the auth check once and redirects anonymous visitors to `/login`.
 *
 * Doing the check here (rather than in middleware) keeps the redirect
 * logic co-located with the data it protects. It also means we can
 * fetch the user once and pass it down via context if we ever need to,
 * without another round-trip to Supabase.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { logout } from "../(auth)/actions";

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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-foreground/10 px-6 py-4">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-widest text-foreground/60">
            EvidenceOS
          </span>
          <span className="text-sm font-medium">Dashboard</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-foreground/60">{user.email}</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-foreground/15 px-3 py-1 text-sm hover:bg-foreground/5"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
