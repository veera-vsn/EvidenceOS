/**
 * Next's native robots file convention. Belt-and-suspenders alongside
 * the root layout's `robots: { index: false }` meta tag (which covers
 * the whole app by default) -- explicitly allows the public blog and
 * disallows the authenticated app surface, rather than relying on the
 * meta tag alone.
 */

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog"],
        disallow: ["/dashboard", "/login", "/signup", "/auth"],
      },
    ],
    sitemap: "https://evidenceos.eu/sitemap.xml",
  };
}
