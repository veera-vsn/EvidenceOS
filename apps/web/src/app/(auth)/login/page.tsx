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

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";

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
        <Logo />
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
              All persistent data stored in EU regions
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
            <Alert variant="success" title="Check your inbox" className="mb-4">
              We sent a confirmation link. Confirm your email, then sign in below.
            </Alert>
          )}

          {error && (
            <Alert variant="error" title="Couldn't sign you in" className="mb-4">
              {error}
            </Alert>
          )}

          <form action={login} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@yourfirm.eu"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <FieldLabel>Password</FieldLabel>
              <Input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                minLength={8}
                placeholder="••••••••"
              />
            </label>

            <Button type="submit" className="mt-1">
              Sign in
            </Button>
          </form>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-fg-3">
              Forgot your password?{" "}
              <a href="mailto:hello@evidenceos.eu" className="underline hover:text-fg">
                Email us
              </a>{" "}
              and we&apos;ll help you back in.
            </span>
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
