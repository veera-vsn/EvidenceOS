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

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-foreground/60">
          EvidenceOS
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign in to continue
        </h1>
        <p className="text-sm text-foreground/70">
          Access your workspace and pick up your RoI in progress.
        </p>
      </header>

      {notice === "check-email" ? (
        <p
          role="status"
          className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-foreground/80"
        >
          Check your inbox — we sent you a confirmation link. Open it in the
          same browser to finish signing up.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-foreground/90"
        >
          {error}
        </p>
      ) : null}

      <form action={login} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground/80">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground/80">Password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            minLength={8}
            className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          Sign in
        </button>
      </form>

      <p className="text-sm text-foreground/60">
        New here?{" "}
        <Link href="/signup" className="font-medium text-foreground underline">
          Create an account
        </Link>
      </p>
    </section>
  );
}
