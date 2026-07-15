# Export UI — walkthrough

## Why a Route Handler, not a Server Action

Every prior mutation in this app (`submitFieldReview`, `startPipelineRun`,
`deleteDocument`) is a Server Action — but a Server Action's return value
is serialized for React, it can't hand the browser raw bytes with
`Content-Type`/`Content-Disposition` headers to trigger a real file
download. `apps/web/src/app/dashboard/[workspaceSlug]/export/download/route.ts`
is a plain Next.js Route Handler (`export async function GET(...)`)
instead — the same mechanism this app already uses for the OAuth
callback (`apps/web/src/app/auth/callback/route.ts`), just used here for
proxying a download instead of a redirect.

## Preserving the trust boundary

Every FastAPI pipeline endpoint is unauthenticated at the HTTP layer —
`revalidate`, `trigger`, and now `export` all trust that only the Next.js
*server* calls them, never the browser directly. The Route Handler is
what keeps that true for exports:

```ts
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: workspace } = await supabase
    .from("workspaces").select("id").eq("slug", workspaceSlug).single();
  if (!workspace) return new NextResponse("Workspace not found.", { status: 404 });

  const apiRes = await fetch(`${env.API_BASE_URL}/pipeline/workspaces/${workspace.id}/export`);
  ...
}
```

Auth check, then the exact same RLS-backed slug→id membership check every
other page in this app already relies on (`workspaces` select returns
`null` for a slug the user isn't a member of), *before* the
server-to-server call to FastAPI. There is no direct browser link to
FastAPI anywhere in this feature — the Export page's download control is
a plain `<a href="/dashboard/${workspaceSlug}/export/download">`, always
same-origin.

## Export page — display-only eligibility

`export/page.tsx` runs the same "latest validated version, `reviewedCount
=== totalCount`" computation the Review list page already does, purely so
the user sees an accurate "N ready / M not yet ready" summary before
clicking download — not because this page's answer is authoritative. If
a document's review state changes in another tab between this page
loading and the download link being clicked, `export.py`'s
`determine_export_eligibility()` (re-run fresh on every request) is what
actually decides what ends up in the zip, not this page's snapshot.

## Nav

One more `<Link>` in `[workspaceSlug]/layout.tsx`'s existing `<nav>`,
identical styling to Documents/Pipeline/Review — no new visual pattern.
