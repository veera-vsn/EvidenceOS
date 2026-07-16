/**
 * Layout for workspace-scoped routes (/dashboard/[workspaceSlug]/*).
 *
 * Resolves the slug to a workspace row, verifies membership, and injects
 * the persistent left sidebar (logo, workspace switcher, section nav,
 * user footer) around all child pages. If the slug does not match any
 * workspace the authenticated user belongs to, redirects to the
 * dashboard workspace list.
 *
 * The parent dashboard layout already guarantees the user is signed in, so
 * this layout only needs to handle the workspace-membership check.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";
import { getCurrentWorkspaceRole } from "@/lib/supabase/workspace-role";
import type { WorkspaceRow } from "@/lib/supabase/database.types";

import { SidebarNav } from "./sidebar-nav";
import { SidebarShell } from "./sidebar-shell";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

interface DocumentVersionForQueue {
  extraction_results: { field_code: string }[];
  validation_results: { field_code: string }[];
  field_reviews: { field_code: string }[];
}

/** Documents whose latest validated version has been started but not
 * fully reviewed — the same "in queue" definition the Review pages use. */
async function countReviewQueue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<number> {
  const { data } = await supabase
    .from("documents")
    .select(`
      document_versions (
        version_number,
        extraction_results ( field_code ),
        validation_results ( field_code ),
        field_reviews ( field_code )
      )
    `)
    .eq("workspace_id", workspaceId)
    .returns<{ document_versions: (DocumentVersionForQueue & { version_number: number })[] }[]>();

  let count = 0;
  for (const doc of data ?? []) {
    const eligible = (doc.document_versions ?? []).filter((v) => v.validation_results.length > 0);
    if (eligible.length === 0) continue;
    const latest = eligible.reduce((a, b) => (b.version_number > a.version_number ? b : a));
    const reviewed = new Set(latest.field_reviews.map((r) => r.field_code)).size;
    const total = latest.extraction_results.length;
    if (reviewed < total) count += 1;
  }
  return count;
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

  const [role, reviewQueueCount] = await Promise.all([
    user ? getCurrentWorkspaceRole(supabase, workspace.id, user.id) : Promise.resolve(null),
    countReviewQueue(supabase, workspace.id),
  ]);

  const workspaceInitial = workspace.name.charAt(0).toUpperCase();
  const userLabel = user?.email?.split("@")[0] ?? "";
  const userInitials = userLabel.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <SidebarShell>
        <div className="px-3.5 pt-3.5 pb-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-fg">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-md bg-accent">
              <span className="h-2 w-2 rounded-sm border-2 border-accent-fg" />
            </span>
            <span className="text-[14px] font-semibold">EvidenceOS</span>
          </Link>
        </div>

        <div className="px-2.5 pb-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2 py-2">
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-accent-soft text-[11px] font-semibold text-accent">
              {workspaceInitial}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-fg">{workspace.name}</div>
              <div className="font-mono text-[10px] text-fg-3">{workspace.slug}</div>
            </div>
          </div>
        </div>

        <SidebarNav workspaceSlug={workspaceSlug} reviewQueueCount={reviewQueueCount} />

        <div className="mt-auto flex items-center gap-2 border-t border-border-2 px-3.5 py-3">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-soft text-[10.5px] font-semibold text-accent">
            {userInitials}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium text-fg">{userLabel}</div>
            <div className="text-[10.5px] capitalize text-fg-3">{role ?? "member"}</div>
          </div>
          <form action={logout} className="ml-auto">
            <button
              type="submit"
              className="rounded-md border border-border px-1.5 py-1 text-[10.5px] text-fg-2 hover:bg-surface-2"
              title="Sign out"
            >
              Sign out
            </button>
          </form>
        </div>
      </SidebarShell>

      <main className="h-full min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
