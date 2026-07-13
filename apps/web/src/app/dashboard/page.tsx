/**
 * `/dashboard` — home screen once signed in.
 *
 * For the walking skeleton this page does three jobs:
 *   1. Confirms auth works end-to-end (we render the caller's email).
 *   2. Lists the workspaces they belong to — proving RLS lets a user
 *      see their own memberships and no one else's.
 *   3. Offers a "create workspace" form when they belong to none, so
 *      the very first signup can bootstrap themselves.
 */

import { createClient } from "@/lib/supabase/server";
import type { WorkspaceRow } from "@/lib/supabase/database.types";

import { createWorkspace } from "./actions";

interface DashboardPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { error } = await searchParams;

  const supabase = await createClient();

  // Layout guarantees `user` is non-null by the time we render here,
  // but the query still filters by RLS — the SDK just uses the JWT
  // that middleware kept warm.
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, slug, created_at, created_by")
    .order("created_at", { ascending: true })
    .returns<WorkspaceRow[]>();

  const hasWorkspaces = (workspaces?.length ?? 0) > 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-foreground/90"
        >
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your workspaces
        </h1>
        <p className="text-sm text-foreground/70">
          Each workspace is one organisation. RLS keeps them fully isolated
          from one another.
        </p>
      </section>

      {hasWorkspaces ? (
        <ul className="flex flex-col gap-3">
          {workspaces!.map((workspace) => (
            <li
              key={workspace.id}
              className="rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3"
            >
              <div className="text-sm font-medium">{workspace.name}</div>
              <div className="font-mono text-xs text-foreground/50">
                {workspace.slug}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-6">
          <h2 className="text-lg font-medium">
            Create your first workspace
          </h2>
          <p className="text-sm text-foreground/70">
            Name it after your organisation. You will be its owner and can
            invite teammates later.
          </p>
          <form action={createWorkspace} className="flex flex-col gap-3">
            <input
              type="text"
              name="name"
              required
              placeholder="Acme Payments Ltd."
              className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
            />
            <button
              type="submit"
              className="self-start rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90"
            >
              Create workspace
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
