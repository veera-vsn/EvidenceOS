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
import { env } from "@/lib/env";

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
