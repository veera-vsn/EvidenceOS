/**
 * Layout for workspace-scoped routes (/dashboard/[workspaceSlug]/*).
 *
 * Resolves the slug to a workspace row, verifies membership, and injects
 * a workspace-level navigation bar above all child pages. If the slug does
 * not match any workspace the authenticated user belongs to, redirects to
 * the dashboard workspace list.
 *
 * The parent dashboard layout already guarantees the user is signed in, so
 * this layout only needs to handle the workspace-membership check.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";
import type { WorkspaceRow } from "@/lib/supabase/database.types";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { workspaceSlug } = await params;

  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug, created_at, created_by")
    .eq("slug", workspaceSlug)
    .single<WorkspaceRow>();

  // Not found or no membership (RLS returns null for rows the user can't see).
  if (!workspace) {
    redirect("/dashboard");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-foreground/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-xs font-medium uppercase tracking-widest text-foreground/50 hover:text-foreground/80"
            >
              EvidenceOS
            </Link>
            <span className="text-foreground/20">/</span>
            <span className="text-sm font-medium">{workspace.name}</span>
          </div>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href={`/dashboard/${workspaceSlug}/documents`}
              className="rounded-md px-3 py-1.5 text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
            >
              Documents
            </Link>
            <Link
              href={`/dashboard/${workspaceSlug}/pipeline`}
              className="rounded-md px-3 py-1.5 text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
            >
              Pipeline
            </Link>
            <Link
              href={`/dashboard/${workspaceSlug}/review`}
              className="rounded-md px-3 py-1.5 text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
            >
              Review
            </Link>
            <Link
              href={`/dashboard/${workspaceSlug}/export`}
              className="rounded-md px-3 py-1.5 text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
            >
              Export
            </Link>
          </nav>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-foreground/50">{user?.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-foreground/15 px-3 py-1 text-sm hover:bg-foreground/5"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
