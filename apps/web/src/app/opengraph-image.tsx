/**
 * Auto-generated Open Graph / Twitter Card preview image.
 *
 * Next.js's file-convention API (`next/og`'s ImageResponse) renders this
 * to a real PNG at request time and wires up the og:image / twitter:image
 * meta tags automatically -- no static asset to design/upload/keep in
 * sync. Colors match globals.css's dark-theme tokens exactly (the app's
 * default look), not a separate one-off palette.
 *
 * Added 2026-07-20: previously no OG/Twitter metadata existed at all, so
 * sharing an EvidenceOS link on LinkedIn -- the landing page's own
 * stated primary outreach channel -- rendered a bare link with no
 * preview (Project_Docs/AUDIT_2026-07-18.md, SEO Audit).
 */
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: "3px solid #16211f",
              }}
            />
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#eeebe6" }}>
            EvidenceOS
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.15,
              color: "#eeebe6",
              maxWidth: 980,
            }}
          >
            The AI copilot for the DORA Register of Information
          </div>
          <div style={{ fontSize: 26, color: "#a89e93", maxWidth: 880 }}>
            Upload ICT vendor contracts. Deterministic rules validate every
            extracted field. A human approves every value before export.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
