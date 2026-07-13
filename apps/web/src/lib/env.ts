/**
 * Typed environment access for the web app.
 *
 * Why this file exists:
 *   - `process.env.FOO` is always `string | undefined` in TypeScript.
 *   - Referring to env vars directly across the codebase makes it hard
 *     to see which ones we actually depend on.
 *   - A single typed accessor lets us fail loudly at boot if a required
 *     var is missing, instead of hitting an obscure runtime error later.
 *
 * Rule of thumb:
 *   - Vars prefixed `NEXT_PUBLIC_` are safe to expose to the browser.
 *   - Everything else is server-only and must never appear in a
 *     Client Component's rendered output.
 *
 * IMPORTANT — static access for NEXT_PUBLIC_ vars:
 *   Next.js / Turbopack inlines NEXT_PUBLIC_ values at compile time by
 *   doing a text-substitution pass. It only recognises STATIC property
 *   access (`process.env.NEXT_PUBLIC_FOO`). Dynamic bracket access
 *   (`process.env[name]`) is invisible to the compiler, so the value
 *   is never embedded in the client bundle and reads as `undefined` in
 *   the browser. All NEXT_PUBLIC_ vars must therefore be read with the
 *   literal dot-notation form and passed as already-resolved values into
 *   any validation helper.
 */

/**
 * Validate a required env value that was already resolved by the caller
 * using a static `process.env.NEXT_PUBLIC_*` reference.
 */
function requirePublicEnv(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Did you copy .env.example to .env.local?`,
    );
  }
  return value;
}

/**
 * Read a required SERVER-ONLY env variable (dynamic key is fine here
 * because server-side Node.js does not need compile-time substitution).
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Did you copy .env.example to .env.local?`,
    );
  }
  return value;
}

/**
 * Read an optional env var with a fallback (server-only).
 */
export function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  /**
   * Public-facing API base URL (server + client safe).
   * Static access required — see file-level note above.
   */
  API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000",

  /** Current deploy environment for observability tags. */
  APP_ENV: process.env.NEXT_PUBLIC_APP_ENV?.trim() || "local",

  /**
   * Supabase — required from Phase 0.5 onwards. The anon key is
   * designed to be shipped to the browser; Row-Level Security is what
   * enforces isolation. Both must be present or the app will not boot.
   *
   * Static access required — see file-level note above.
   */
  SUPABASE_URL: requirePublicEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL",
  ),
  SUPABASE_ANON_KEY: requirePublicEnv(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ),
} as const;
