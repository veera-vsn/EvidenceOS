/**
 * Blog content loading -- file-based (MDX in `content/blog/`), no CMS or
 * database table, since these are static, author-written articles rather
 * than user-generated content. Consistent with this project's stated
 * preference for the simplest sufficient tool (see e.g. BackgroundTasks
 * over Celery in the pipeline worker) -- a handful of launch articles
 * don't warrant a content management system.
 */

import { readdirSync, readFileSync } from "fs";
import path from "path";

import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  excerpt: string;
}

export interface BlogPostSummary extends BlogFrontmatter {
  slug: string;
  /** Minutes, rounded up -- word count / 200wpm. No `reading-time`
   * dependency needed for arithmetic this simple. */
  readingTimeMinutes: number;
}

function slugFromFilename(filename: string): string {
  return filename.replace(/\.mdx$/, "");
}

function computeReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Every post's frontmatter + slug, sorted newest first. Does not
 * compile MDX bodies -- cheap enough to call from the list page and the
 * sidebar without needing separate "lite" data. */
export function getAllPosts(): BlogPostSummary[] {
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));

  const posts = files.map((filename) => {
    const raw = readFileSync(path.join(BLOG_DIR, filename), "utf8");
    const { data, content } = matter(raw);
    const frontmatter = data as BlogFrontmatter;
    return {
      ...frontmatter,
      slug: slugFromFilename(filename),
      readingTimeMinutes: computeReadingTime(content),
    };
  });

  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Raw MDX source + frontmatter for one post, for the article page to
 * compile with `next-mdx-remote/rsc`'s `compileMDX`. Returns null for an
 * unknown slug rather than throwing -- the caller decides whether that's
 * a 404. */
export function getPostSource(
  slug: string,
): { frontmatter: BlogFrontmatter; content: string; readingTimeMinutes: number } | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  const { data, content } = matter(raw);
  return {
    frontmatter: data as BlogFrontmatter,
    content,
    readingTimeMinutes: computeReadingTime(content),
  };
}

/** Up to `limit` other posts sharing at least one tag with `slug`,
 * falling back to most-recent if nothing shares a tag -- used by the
 * sidebar's "latest posts" and could extend to an in-article "related
 * reading" section later. */
export function getRelatedPosts(slug: string, limit = 3): BlogPostSummary[] {
  const all = getAllPosts();
  const current = all.find((p) => p.slug === slug);
  const others = all.filter((p) => p.slug !== slug);

  if (!current) return others.slice(0, limit);

  const related = others.filter((p) => p.tags.some((t) => current.tags.includes(t)));
  const rest = others.filter((p) => !related.includes(p));
  return [...related, ...rest].slice(0, limit);
}

/** Every distinct tag across all posts, with a count -- feeds the
 * sidebar's category accordion. */
export function getAllTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
