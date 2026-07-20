/**
 * `/dashboard` — home screen once signed in.
 *
 * Renders its own top bar (logo + sign out) since the outer
 * `dashboard/layout.tsx` only enforces auth and doesn't render chrome —
 * workspace-scoped pages get the sidebar from
 * `[workspaceSlug]/layout.tsx` instead, so this page needs its own.
 *
 * Two states: a list of the caller's workspaces (the common case), or a
 * "create your first workspace" onboarding card when they belong to none.
 */

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";
import type { WorkspaceRow } from "@/lib/supabase/database.types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";

import { createWorkspace } from "./actions";

interface DashboardPageProps {
  searchParams: Promise<{ error?: string }>;
}

interface WorkspaceWithCount extends WorkspaceRow {
  documents: { count: number }[];
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, slug, created_at, created_by, documents(count)")
    .order("created_at", { ascending: true })
    .returns<WorkspaceWithCount[]>();

  const hasWorkspaces = (workspaces?.length ?? 0) > 0;
  const userLabel = user?.email?.split("@")[0] ?? "";
  const userInitials = userLabel.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border-2 bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-8 py-4">
          <Logo href={null} />
          <div className="flex items-center gap-3.5">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
              {userInitials}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1.5 text-[13px] text-fg-2 hover:bg-surface-2"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-12">
        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        {hasWorkspaces ? (
          <div>
            <div className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">
              Your workspaces
            </div>
            <h1 className="mt-2.5 mb-1.5 text-2xl font-semibold tracking-tight text-fg">
              Choose a workspace
            </h1>
            <p className="mb-7 max-w-lg text-[14.5px] text-fg-2">
              Each workspace is one organisation, fully isolated — its
              documents, runs, reviews and exports never mix with another&apos;s.
            </p>

            <div className="flex flex-col gap-3">
              {workspaces!.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/dashboard/${ws.slug}/documents`}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-[22px] py-5 shadow-card hover:border-accent-line"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-accent-soft text-base font-semibold text-accent">
                      {ws.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <div className="text-base font-semibold text-fg">{ws.name}</div>
                      <div className="mt-0.5 font-mono text-xs text-fg-3">{ws.slug}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-[18px]">
                    <span className="text-[12.5px] text-fg-2">
                      {ws.documents[0]?.count ?? 0} documents
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent">
                      Open <span className="text-[15px]">→</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <details className="mt-4 rounded-xl border border-dashed border-border">
              <summary className="cursor-pointer list-none px-[18px] py-3.5 text-center text-[13.5px] text-fg-2">
                <span className="text-base leading-none">+</span> Create another workspace
              </summary>
              <form action={createWorkspace} className="flex flex-col gap-3 px-[18px] pb-[18px]">
                <Input type="text" name="name" required placeholder="e.g. Meridian Payments Ltd" />
                <Button type="submit" className="self-start">
                  Create workspace
                </Button>
              </form>
            </details>
          </div>
        ) : (
          <div className="mx-auto mt-5 max-w-[520px]">
            <div className="mb-2 text-center">
              <div className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">
                Welcome to EvidenceOS
              </div>
              <h1 className="mt-2.5 mb-1.5 text-2xl font-semibold tracking-tight text-fg">
                Create your first workspace
              </h1>
              <p className="mx-auto max-w-[420px] text-[14.5px] text-fg-2">
                A workspace holds one organisation&apos;s contracts and
                filings. You&apos;ll be its owner — you can invite colleagues
                later.
              </p>
            </div>
            <div className="mt-6 rounded-2xl border border-border bg-surface p-7 shadow-card">
              <form action={createWorkspace} className="flex flex-col gap-2">
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-medium text-fg">Organisation name</span>
                  <Input type="text" name="name" required placeholder="e.g. Meridian Payments Ltd" />
                  <span className="text-[11.5px] text-fg-3">
                    We&apos;ll generate a machine-readable slug from this —
                    e.g. <span className="font-mono text-fg-2">meridian-payments</span>
                  </span>
                </label>
                <Button type="submit" size="lg" className="mt-5 w-full">
                  Create workspace &amp; continue
                </Button>
              </form>
            </div>
            <div className="mt-[26px] flex items-center justify-center gap-[26px] text-[12.5px] text-fg-3">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> 1 · Create workspace
              </span>
              <span className="flex items-center gap-2 opacity-60">
                <span className="h-1.5 w-1.5 rounded-full bg-border" /> 2 · Upload contracts
              </span>
              <span className="flex items-center gap-2 opacity-60">
                <span className="h-1.5 w-1.5 rounded-full bg-border" /> 3 · Run the pipeline
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
