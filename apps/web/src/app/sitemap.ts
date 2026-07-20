/**
 * Next's native sitemap file convention -- no dependency needed. Lists
 * the public marketing pages and every blog article. Deliberately
 * excludes /login, /signup, and everything under /dashboard, which stay
 * behind the root layout's blanket `robots: { index: false }` (see
 * apps/web/src/app/layout.tsx) -- a sitemap entry for a noindexed page
 * would just confuse crawlers.
 */

import type { MetadataRoute } from "next";

import { getAllPosts } from "@/lib/blog";

const BASE_URL = "https://evidenceos.eu";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const postRoutes: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...postRoutes];
}
