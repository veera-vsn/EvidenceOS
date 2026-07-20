/**
 * Content sidebar for the blog -- list page and article pages both use
 * this. Follows
 * .claude/skills/frontend-enterprise-design/references/sidebar-patterns.md's
 * content-sidebar spec: 300px, sticky below the header, ordered
 * search -> newsletter -> latest posts -> categories (collapsible past
 * ~6) -> author card. No separate tag cloud at the bottom -- in this
 * blog tags *are* the categories (one taxonomy, not two), so a second
 * tag-cloud section would just repeat the categories list; the
 * reference file explicitly allows omitting a widget that isn't
 * pulling its own weight.
 *
 * Search is a plain `<form method="get" action="/blog">` -- a real page
 * navigation to `/blog?q=...`, not client-side filtering. Zero JS,
 * consistent with this app's existing `?page=N` pagination pattern
 * (see dashboard/_components/pagination-nav.tsx) and works identically
 * whether the sidebar is currently rendered on the list page or an
 * article page.
 *
 * Server Component -- the only client-side piece is NewsletterForm,
 * rendered as a child.
 */

import Link from "next/link";

import type { BlogPostSummary } from "@/lib/blog";

import { NewsletterForm } from "./newsletter-form";

const CATEGORIES_SHOWN_BY_DEFAULT = 6;

interface BlogSidebarProps {
  latestPosts: BlogPostSummary[];
  tags: { tag: string; count: number }[];
  activeTag?: string;
}

export function BlogSidebar({ latestPosts, tags, activeTag }: BlogSidebarProps) {
  const visibleTags = tags.slice(0, CATEGORIES_SHOWN_BY_DEFAULT);
  const overflowTags = tags.slice(CATEGORIES_SHOWN_BY_DEFAULT);

  return (
    <aside className="flex w-full flex-none flex-col gap-6 lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-112px)] lg:w-[300px] lg:overflow-y-auto lg:pb-6">
      <form method="get" action="/blog" className="flex gap-2">
        <input
          type="search"
          name="q"
          placeholder="Search articles…"
          className="w-full rounded-[9px] border border-border bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent"
        />
      </form>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <NewsletterForm />
      </div>

      {latestPosts.length > 0 && (
        <div>
          <div className="mb-2.5 font-mono text-[10.5px] tracking-[0.1em] text-fg-3 uppercase">
            Latest articles
          </div>
          <ul className="flex flex-col gap-3">
            {latestPosts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="block text-[13px] leading-snug font-medium text-fg hover:text-accent"
                >
                  {post.title}
                </Link>
                <div className="mt-0.5 font-mono text-[11px] text-fg-3">
                  {new Date(post.date).toLocaleDateString("en-IE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tags.length > 0 && (
        <div>
          <div className="mb-2.5 font-mono text-[10.5px] tracking-[0.1em] text-fg-3 uppercase">
            Browse by topic
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visibleTags.map((t) => (
              <TagPill key={t.tag} {...t} active={t.tag === activeTag} />
            ))}
          </div>
          {overflowTags.length > 0 && (
            <details className="mt-1.5 group">
              <summary className="cursor-pointer list-none text-[12px] font-medium text-accent">
                + {overflowTags.length} more
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {overflowTags.map((t) => (
                  <TagPill key={t.tag} {...t} active={t.tag === activeTag} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface-2 p-4">
        <div className="text-[13px] font-semibold text-fg">The EvidenceOS Team</div>
        <p className="mt-1 text-[12px] leading-relaxed text-fg-2">
          Building the AI copilot for the DORA Register of Information.
        </p>
        <a
          href="mailto:hello@evidenceos.eu"
          className="mt-2 inline-block text-[12px] font-medium text-accent underline"
        >
          hello@evidenceos.eu
        </a>
      </div>
    </aside>
  );
}

function TagPill({ tag, count, active }: { tag: string; count: number; active: boolean }) {
  return (
    <Link
      href={`/blog?tag=${encodeURIComponent(tag)}`}
      className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium transition ${
        active ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-2 hover:bg-border-2"
      }`}
    >
      {tag} <span className="opacity-60">{count}</span>
    </Link>
  );
}

/** Mobile equivalent -- a horizontal pill-scroll above the article
 * instead of a full sidebar stacked below it, per the sidebar-patterns
 * reference's mobile guidance. Search collapses to a single link to the
 * full list page rather than an inline field, since a full-width search
 * box above the fold competes too hard with the article title on a
 * small screen. */
export function BlogMobileTopBar({
  tags,
  activeTag,
}: {
  tags: { tag: string; count: number }[];
  activeTag?: string;
}) {
  if (tags.length === 0) return null;

  return (
    <div className="mb-4 flex items-center gap-2 lg:hidden">
      <Link
        href="/blog"
        aria-label="Search articles"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border text-fg-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </Link>
      <div className="flex gap-1.5 overflow-x-auto">
        {tags.map((t) => (
          <TagPill key={t.tag} {...t} active={t.tag === activeTag} />
        ))}
      </div>
    </div>
  );
}
