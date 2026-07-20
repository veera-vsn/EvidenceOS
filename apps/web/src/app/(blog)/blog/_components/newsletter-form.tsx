"use client";

/**
 * The sidebar's newsletter signup -- the highest-conversion widget per
 * the content-sidebar pattern (see
 * .claude/skills/frontend-enterprise-design/references/sidebar-patterns.md),
 * so it gets real inline pending/success feedback rather than a full
 * page reload. Same useTransition + inline error pattern as
 * start-run-form.tsx, for consistency with the rest of the app rather
 * than introducing a different form pattern (e.g. useActionState) for
 * just this one component.
 */

import { useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { subscribeToNewsletter } from "../actions";

export function NewsletterForm() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      const result = await subscribeToNewsletter({ error: null, success: false }, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setEmail("");
      }
    });
  }

  if (success) {
    return (
      <Alert variant="success" title="You&apos;re subscribed">
        We&apos;ll email you when there&apos;s a new article.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="text-[13px] font-semibold text-fg">Get new articles by email</div>
      <p className="text-[12px] leading-relaxed text-fg-2">
        DORA RoI compliance insights, roughly monthly. No spam.
      </p>
      {error && (
        <Alert variant="error" className="mt-1">
          {error}
        </Alert>
      )}
      <Input
        type="email"
        required
        placeholder="you@yourfirm.eu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isPending}
        className="mt-1"
      />
      <Button type="submit" size="sm" disabled={isPending} className="mt-0.5">
        {isPending ? "Subscribing…" : "Subscribe"}
      </Button>
    </form>
  );
}
