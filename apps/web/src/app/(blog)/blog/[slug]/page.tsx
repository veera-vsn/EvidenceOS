/**
 * `/blog/[slug]` — article body + sidebar.
 *
 * `robots: { index: true, follow: true }` deliberately overrides the
 * root layout's blanket `noindex` (see apps/web/src/app/layout.tsx) --
 * the app itself stays unindexed pre-launch, but public articles should
 * be crawlable for the SEO/content-marketing purpose the blog exists
 * for. Per-segment metadata in Next.js overrides rather than merges
 * with the parent for the `robots` field specifically.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { getAllPosts, getAllTags, getPostSource, getRelatedPosts } from "@/lib/blog";

import { BlogMobileTopBar, BlogSidebar } from "../_components/blog-sidebar";
import { mdxComponents } from "../_components/mdx-components";

interface BlogArticlePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostSource(slug);
  if (!post) return {};

  return {
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    robots: { index: true, follow: true },
    openGraph: {
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      type: "article",
      publishedTime: post.frontmatter.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.frontmatter.title,
      description: post.frontmatter.description,
    },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const post = getPostSource(slug);
  if (!post) notFound();

  const tags = getAllTags();
  const related = getRelatedPosts(slug, 5);

  return (
    <div>
      <BlogMobileTopBar tags={tags} />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <article className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-fg-3">
            <time dateTime={post.frontmatter.date}>
              {new Date(post.frontmatter.date).toLocaleDateString("en-IE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
            <span>·</span>
            <span>{post.readingTimeMinutes} min read</span>
            <span>·</span>
            <span>{post.frontmatter.author}</span>
          </div>

          <h1 className="mt-2.5 text-[28px] leading-[1.15] font-semibold tracking-tight text-fg sm:text-[32px]">
            {post.frontmatter.title}
          </h1>

          <p className="mt-3.5 text-[16px] leading-relaxed text-fg-2">
            {post.frontmatter.description}
          </p>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {post.frontmatter.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg-2"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="mt-2 border-t border-border-2">
            <MDXRemote
              source={post.content}
              components={mdxComponents}
              options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
            />
          </div>
        </article>

        <BlogSidebar latestPosts={related} tags={tags} />
      </div>
    </div>
  );
}
