/**
 * Backend API client — thin fetch wrapper.
 *
 * Design decisions:
 *   - No SDK yet. A thin `fetch` wrapper is easier to audit and evolve.
 *   - All calls return a discriminated union so callers cannot forget
 *     the error branch. This is the same pattern we will keep as the
 *     API surface grows.
 *   - Server-side calls skip Next.js's fetch cache with `no-store` —
 *     we do not want a stale "healthy" pill after the backend dies.
 */
import { env, requireEnv } from "@/lib/env";

/** Shape returned by GET /health on the FastAPI backend. */
export interface BackendHealth {
  status: "ok" | "degraded";
  env: string;
  version: string;
  timestamp: string;
}

/** Union type consumed by UI code — forces explicit error handling. */
export type HealthResult =
  | { ok: true; env: string; version: string }
  | { ok: false; reason: string };

/**
 * Headers required on every server-side call to a `/pipeline/*` FastAPI
 * route (everything except `/health`, which stays public). The backend
 * is reachable from the public internet, so this shared secret -- not
 * "only Next.js calls this" -- is the actual authentication boundary
 * (2026-07-18 production audit fix, S1). Spread into every such fetch:
 *
 *   fetch(url, { method: "POST", headers: internalApiHeaders() })
 *
 * Reads INTERNAL_API_SECRET lazily via `requireEnv()`, the same pattern
 * `document-encryption.ts` uses for DOCUMENT_ENCRYPTION_KEY -- NOT as a
 * field on the shared `env` object above, which is also imported by
 * client-side code (e.g. lib/supabase/client.ts). A secret evaluated
 * eagerly there would be checked in the browser bundle too, where it's
 * correctly never available -- this function is only ever called from
 * Server Actions/Route Handlers, so evaluating it here, on call, keeps
 * the secret out of any client-importable module entirely.
 */
export function internalApiHeaders(): HeadersInit {
  return { "x-internal-api-key": requireEnv("INTERNAL_API_SECRET") };
}

/**
 * Fetch `/health` from the backend.
 *
 * Returns a discriminated result rather than throwing, because the
 * calling page renders a "down" indicator in the error case — the
 * page itself should still render successfully.
 */
export async function fetchBackendHealth(): Promise<HealthResult> {
  const url = `${env.API_BASE_URL}/health`;
  try {
    const response = await fetch(url, {
      // Do not cache: a stale success pill is worse than no pill.
      cache: "no-store",
      // 3 s timeout keeps the landing page snappy if backend is down.
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as BackendHealth;
    return { ok: true, env: data.env, version: data.version };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
