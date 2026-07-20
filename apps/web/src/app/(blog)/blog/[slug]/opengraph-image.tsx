/**
 * Per-article Open Graph / Twitter Card preview image. Same shell as
 * the root `opengraph-image.tsx` (logo mark, colors) with the headline
 * swapped for the article's own title/description -- see that file's
 * docstring for why this exists as a generated image rather than a
 * static asset.
 */
import { ImageResponse } from "next/og";

import { getPostSource } from "@/lib/blog";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function BlogOpengraphImage({ params }: { params: { slug: string } }) {
  const post = getPostSource(params.slug);
  const title = post?.frontmatter.title ?? "EvidenceOS Blog";
  const description = post?.frontmatter.description ?? "DORA Register of Information insights.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#1a1817",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "#3fb0a8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 6, border: "3px solid #16211f" }} />
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#eeebe6" }}>EvidenceOS</div>
          <div
            style={{
              fontSize: 16,
              color: "#3fb0a8",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginLeft: 8,
            }}
          >
            Blog
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.15,
              color: "#eeebe6",
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 24, color: "#a89e93", maxWidth: 900 }}>{description}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
