/**
 * Shared shell for public legal pages (`/privacy`, `/terms`).
 *
 * A route group, not a URL segment -- `(legal)` doesn't appear in the
 * path. Kept separate from the dashboard layout since these pages are
 * public (no auth, no workspace context) and separate from the landing
 * page since they're plain documents, not a conversion page.
 */

import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-fg">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 sm:px-8 py-[22px]">
        <Logo />
        <Link href="/" className="text-sm text-fg-2">
          ← Back to EvidenceOS
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-4 pb-24 sm:px-8">{children}</main>

      <footer className="border-t border-border-2">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-5 sm:px-8 py-7">
          <span className="text-[13px] text-fg-2">© 2026 EvidenceOS</span>
          <div className="flex gap-5 text-[12.5px] text-fg-2">
            <Link href="/privacy" className="hover:text-fg">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-fg">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
