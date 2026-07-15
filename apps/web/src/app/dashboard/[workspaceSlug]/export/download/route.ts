/**
 * `/dashboard/[workspaceSlug]/export/download` — Route Handler that
 * streams the workspace's draft xBRL-CSV export as a file download.
 *
 * Implemented as a Route Handler, not a Server Action, because a download
 * needs to return raw bytes with Content-Type/Content-Disposition headers
 * to the browser — a Server Action can't do that.
 *
 * Every FastAPI pipeline endpoint is unauthenticated at the HTTP layer and
 * trusts its caller's network position, not the request itself — so this
 * handler is the trust boundary: it verifies the user is signed in and a
 * member of the workspace (the same check `[workspaceSlug]/layout.tsx`
 * already does) *before* calling FastAPI server-to-server. There is no
 * direct browser link to FastAPI anywhere in this app.
 */

import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ workspaceSlug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // RLS returns null for a slug the user isn't a member of — same
  // membership check every Server Action and the workspace layout rely on.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) {
    return new NextResponse("Workspace not found.", { status: 404 });
  }

  const apiRes = await fetch(
    `${env.API_BASE_URL}/pipeline/workspaces/${workspace.id}/export`,
  );

  if (!apiRes.ok) {
    return new NextResponse(await apiRes.text(), { status: apiRes.status });
  }

  const zipBytes = await apiRes.arrayBuffer();
  const filename = `evidenceos-roi-export-${workspaceSlug}-${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(zipBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
