/**
 * `/blog` — article list + sidebar.
 *
 * `?q=` and `?tag=` both filter server-side (plain GET params, no client
 * JS) -- submitted by the sidebar's search form and category pills
 * respectively. Fully static content (no auth, no database), so this
 * could be statically generated, but stays a plain Server Component for
 * now since the article count is tiny and search/tag filtering needs to
 * read the params per-request anyway.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { getAllPosts, getAllTags } from "@/lib/blog";
import { EmptyState } from "@/components/ui/empty-state";

import { BlogMobileTopBar, BlogSidebar } from "./_components/blog-sidebar";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "DORA Register of Information compliance insights -- data quality, ICT third-party risk, and human-in-the-loop AI for regulatory filings.",
  robots: { index: true, follow: true },
};

interface BlogListPageProps {
  searchParams: Promise<{ q?: string; tag?: string }>;
}

export default async function BlogListPage({ searchParams }: BlogListPageProps) {
  const { q, tag } = await searchParams;
  const allPosts = getAllPosts();
  const tags = getAllTags();

  const query = q?.trim().toLowerCase();
  const posts = allPosts.filter((post) => {
    if (tag && !post.tags.includes(tag)) return false;
    if (query) {
      const haystack = `${post.title} ${post.description} ${post.excerpt}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">
          Blog
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">
          DORA RoI compliance, in plain language
        </h1>
        {(query || tag) && (
          <p className="mt-2 text-sm text-fg-2">
            {posts.length} article{posts.length !== 1 ? "s" : ""}
            {tag && (
              <>
                {" "}
                tagged <span className="font-medium text-fg">{tag}</span>
              </>
            )}
            {query && (
              <>
                {" "}
                matching <span className="font-medium text-fg">&ldquo;{q}&rdquo;</span>
              </>
            )}
            {" · "}
            <Link href="/blog" className="text-accent underline">
              clear
            </Link>
          </p>
        )}
      </div>

      <BlogMobileTopBar tags={tags} activeTag={tag} />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <div className="min-w-0 flex-1">
          {posts.length > 0 ? (
            <div className="flex flex-col gap-5">
              {posts.map((post) => (
                <article
                  key={post.slug}
                  className="rounded-2xl border border-border bg-surface p-6"
                >
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-fg-3">
                    <time dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString("en-IE", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                    <span>·</span>
                    <span>{post.readingTimeMinutes} min read</span>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-fg">
                    <Link href={`/blog/${post.slug}`} className="hover:text-accent">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-fg-2">{post.excerpt}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {post.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg-2"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13.5px] font-medium text-accent"
                    >
                      Read article <span className="text-[15px]">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No articles found"
              description="Try a different search term, or browse all articles."
              action={{ label: "View all articles", href: "/blog" }}
            />
          )}
        </div>

        <BlogSidebar latestPosts={allPosts.slice(0, 5)} tags={tags} activeTag={tag} />
      </div>
    </div>
  );
}
