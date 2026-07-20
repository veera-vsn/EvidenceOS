/**
 * Shared shell for the public blog (`/blog`, `/blog/[slug]`).
 *
 * A route group, not a URL segment. Modeled on `(legal)`'s shell
 * (public, no auth, no workspace context) but wider than `(legal)`'s
 * max-w-3xl -- the blog's article+sidebar layout needs the extra room.
 * Shares the landing page's header nav shape (logo + anchor links +
 * sign in/get started) since the blog is also a marketing surface.
 */

import Link from "next/link";

import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-fg">
      <header className="mx-auto flex max-w-[1280px] items-center justify-between px-5 sm:px-8 py-[22px]">
        <Logo />
        <nav className="flex items-center gap-4 sm:gap-7">
          <Link href="/#how" className="hidden text-sm text-fg-2 md:inline">
            How it works
          </Link>
          <Link href="/blog" className="hidden text-sm font-medium text-fg md:inline">
            Blog
          </Link>
          <Link href="/login" className="text-sm font-medium text-fg">
            Sign in
          </Link>
          <Button href="/signup" size="sm">
            Get started
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-[1280px] px-5 pt-4 pb-24 sm:px-8">{children}</main>

      <footer className="border-t border-border-2">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 sm:px-8 py-7">
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
