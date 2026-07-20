/**
 * `/signup` — create a new account.
 *
 * Supabase is configured to require email confirmation, so the Server
 * Action redirects to `/login?notice=check-email` after a successful
 * `signUp` call. The user only actually receives a session once they
 * follow the confirmation link, which lands on `/auth/callback`.
 */

import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";

import { signup } from "../actions";

interface SignupPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* left: brand rail */}
      <div className="hidden flex-col justify-between border-r border-border-2 bg-surface-2 px-12 py-10 md:flex">
        <Logo />
        <div className="max-w-sm">
          <h2 className="text-2xl leading-[1.2] font-semibold tracking-tight text-fg">
            Start with one contract. Ship a filing-ready draft with a full
            evidence trail.
          </h2>
          <div className="mt-7 flex flex-col gap-3.5">
            <div className="flex items-center gap-3 text-[13.5px] text-fg-2">
              <span className="h-[7px] w-[7px] flex-none rounded-full bg-success" />
              Purpose-built for the DORA RoI — not a generic GRC tool
            </div>
            <div className="flex items-center gap-3 text-[13.5px] text-fg-2">
              <span className="h-[7px] w-[7px] flex-none rounded-full bg-success" />
              Deterministic checks flag issues before a human ever signs off
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
            Get started
          </div>
          <h1 className="mt-2.5 mb-1.5 text-[22px] font-semibold tracking-tight text-fg">
            Create your account
          </h1>
          <p className="mb-6 text-sm text-fg-2">
            You&apos;ll set up your workspace right after your first sign-in.
          </p>

          {error && (
            <Alert variant="error" title="Couldn't create your account" className="mb-4">
              {error}
            </Alert>
          )}

          <form action={signup} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <FieldLabel>Full name</FieldLabel>
              <Input type="text" name="display_name" autoComplete="name" placeholder="M. Okafor" />
              <span className="text-[11.5px] text-fg-3">
                Shown on the audit trail of every field you review.
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <FieldLabel>Work email</FieldLabel>
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
                autoComplete="new-password"
                minLength={8}
                placeholder="At least 8 characters"
              />
              <span className="text-[11.5px] text-fg-3">Minimum 8 characters.</span>
            </label>

            <Alert variant="info">
              We&apos;ll send a confirmation link before your account is active —
              check your inbox after this step.
            </Alert>

            <label className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-fg-2">
              <input
                type="checkbox"
                name="accepted_terms"
                required
                className="mt-0.5 h-3.5 w-3.5 flex-none accent-accent"
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="font-medium text-accent underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="font-medium text-accent underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <Button type="submit" className="mt-0.5">
              Create account
            </Button>
          </form>

          <div className="my-[22px] h-px bg-border-2" />
          <p className="text-center text-[13.5px] text-fg-2">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-accent">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
