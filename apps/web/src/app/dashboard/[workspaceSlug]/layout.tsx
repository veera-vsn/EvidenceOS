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
    <div className="flex h-screen overflow-hidden">
      <aside className="flex h-full w-[236px] flex-none flex-col overflow-y-auto border-r border-border-2 bg-surface">
        <div className="px-[18px] pt-[18px] pb-3.5">
          <Link href="/dashboard" className="flex items-center gap-2.5 text-fg">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-accent">
              <span className="h-[9px] w-[9px] rounded-sm border-2 border-accent-fg" />
            </span>
            <span className="text-[15px] font-semibold">EvidenceOS</span>
          </Link>
        </div>

        <div className="px-3 pt-2 pb-3.5">
          <div className="flex items-center gap-2.5 rounded-[9px] border border-border bg-surface-2 px-2.5 py-2.5">
            <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] bg-accent-soft font-serif text-xs font-semibold text-accent">
              {workspaceInitial}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-fg">{workspace.name}</div>
              <div className="font-mono text-[10.5px] text-fg-3">{workspace.slug}</div>
            </div>
          </div>
        </div>

        <SidebarNav workspaceSlug={workspaceSlug} reviewQueueCount={reviewQueueCount} />

        <div className="mt-auto flex items-center gap-2.5 border-t border-border-2 px-[18px] py-3.5">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
            {userInitials}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-medium text-fg">{userLabel}</div>
            <div className="text-[11px] capitalize text-fg-3">{role ?? "member"}</div>
          </div>
          <form action={logout} className="ml-auto">
            <button
              type="submit"
              className="rounded-md border border-border px-2 py-1 text-[11px] text-fg-2 hover:bg-surface-2"
              title="Sign out"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="h-full min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
