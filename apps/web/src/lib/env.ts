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
 */

/**
 * Read a required string environment variable. Throws at import time on
 * the server if the variable is missing — this is intentional: we want
 * boot to fail fast in local dev if `.env.local` is misconfigured.
 *
 * @param name - name of the env var
 * @returns the value as a non-empty string
 */
function requireEnv(name: string): string {
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
 * Read an optional env var with a fallback.
 */
function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  /** Public-facing API base URL (server + client safe). */
  API_BASE_URL: optionalEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000"),

  /** Current deploy environment for observability tags. */
  APP_ENV: optionalEnv("NEXT_PUBLIC_APP_ENV", "local"),

  /**
   * Supabase — required from Phase 0.5 onwards. The anon key is
   * designed to be shipped to the browser; Row-Level Security is what
   * enforces isolation. Both must be present or the app will not boot.
   */
  SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
} as const;

/**
 * Kept exported so future callers that genuinely need "throw if missing"
 * semantics (e.g. server-only secrets) can reuse the same pattern.
 */
export { requireEnv, optionalEnv };
