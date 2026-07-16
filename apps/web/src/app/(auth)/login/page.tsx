/**
 * `/login` — sign an existing user in.
 *
 * Rendered as a Server Component. The `<form action={login}>` binding
 * runs the Server Action from `../actions.ts` when the browser submits
 * the form; no client-side JavaScript is shipped for the happy path.
 *
 * Error and notice states arrive via `searchParams` — the action
 * itself redirects on both success and failure, so this page has no
 * mutable state of its own.
 */

import Link from "next/link";

import { login } from "../actions";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; notice?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, notice } = await searchParams;
  const showSuccess = notice === "check-email";

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* left: brand rail */}
      <div className="hidden flex-col justify-between border-r border-border-2 bg-surface-2 px-12 py-10 md:flex">
        <Link href="/" className="flex items-center gap-2.5 text-fg">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-accent">
            <span className="h-2.5 w-2.5 rounded-sm border-2 border-accent-fg" />
          </span>
          <span className="text-base font-semibold">EvidenceOS</span>
        </Link>
        <div className="max-w-sm">
          <h2 className="text-2xl leading-[1.2] font-semibold tracking-tight text-fg">
            The DORA Register of Information, extracted, validated, and
            human-approved.
          </h2>
          <div className="mt-7 flex flex-col gap-3.5">
            <div className="flex items-center gap-3 text-[13.5px] text-fg-2">
              <span className="h-[7px] w-[7px] flex-none rounded-full bg-success" />
              Every field traces to its source document
            </div>
            <div className="flex items-center gap-3 text-[13.5px] text-fg-2">
              <span className="h-[7px] w-[7px] flex-none rounded-full bg-success" />
              A human approves every value before export
            </div>
            <div className="flex items-center gap-3 text-[13.5px] text-fg-2">
              <span className="h-[7px] w-[7px] flex-none rounded-full bg-success" />
              All data stays in EU regions
            </div>
          </div>
        </div>
        <div className="font-mono text-[11px] tracking-wide text-fg-3">
          EU financial-services compliance · DORA RoI
        </div>
      </div>

      {/* right: form */}
      <div className="flex items-center justify-center px-6 py-8 sm:px-10 sm:py-10">
        <div className="w-full max-w-[380px]">
          <div className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">
            Welcome back
          </div>
          <h1 className="mt-2.5 mb-1.5 text-[22px] font-semibold tracking-tight text-fg">
            Sign in to continue
          </h1>
          <p className="mb-6 text-sm text-fg-2">
            Access your workspace and pick up your review queue.
          </p>

          {showSuccess && (
            <div
              role="status"
              className="mb-4 flex gap-2.5 rounded-[10px] border border-success bg-success-soft px-3.5 py-3"
            >
              <span className="text-[15px] leading-tight text-success">✓</span>
              <div>
                <div className="text-[13.5px] font-semibold text-success">
                  Check your inbox
                </div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-2">
                  We sent a confirmation link. Confirm your email, then sign in
                  below.
                </div>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 flex gap-2.5 rounded-[10px] border border-danger bg-danger-soft px-3.5 py-3"
            >
              <span className="text-[15px] leading-tight text-danger">!</span>
              <div>
                <div className="text-[13.5px] font-semibold text-danger">
                  Couldn&apos;t sign you in
                </div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-2">
                  {error}
                </div>
              </div>
            </div>
          )}

          <form action={login} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-fg">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@yourfirm.eu"
                className="w-full rounded-[9px] border border-border bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-fg">Password</span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                minLength={8}
                placeholder="••••••••"
                className="w-full rounded-[9px] border border-border bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent"
              />
            </label>

            <button
              type="submit"
              className="mt-1 rounded-[9px] bg-accent px-3 py-3 text-sm font-semibold text-accent-fg transition hover:opacity-90"
            >
              Sign in
            </button>
          </form>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-fg-3">No reset flow yet</span>
          </div>

          <div className="my-[22px] h-px bg-border-2" />
          <p className="text-center text-[13.5px] text-fg-2">
            New to EvidenceOS?{" "}
            <Link href="/signup" className="font-semibold text-accent">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
