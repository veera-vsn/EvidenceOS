/**
 * `/signup` — create a new account.
 *
 * Supabase is configured to require email confirmation, so the Server
 * Action redirects to `/login?notice=check-email` after a successful
 * `signUp` call. The user only actually receives a session once they
 * follow the confirmation link, which lands on `/auth/callback`.
 */

import Link from "next/link";

import { signup } from "../actions";

interface SignupPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-foreground/60">
          EvidenceOS
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-foreground/70">
          One workspace per organisation — you can invite teammates once you
          are in.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-foreground/90"
        >
          {error}
        </p>
      ) : null}

      <form action={signup} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground/80">Full name</span>
          <input
            type="text"
            name="display_name"
            autoComplete="name"
            className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground/80">Work email</span>
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
            autoComplete="new-password"
            minLength={8}
            className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
          <span className="text-xs text-foreground/50">
            Minimum eight characters.
          </span>
        </label>

        <button
          type="submit"
          className="mt-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          Create account
        </button>
      </form>

      <p className="text-sm text-foreground/60">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
