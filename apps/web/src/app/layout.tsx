/**
 * Root layout for every route in the EvidenceOS web app.
 *
 * In the Next.js App Router, `RootLayout` wraps every page and is the
 * only place where you render <html> and <body>. It runs as a Server
 * Component by default, so anything imported here (fonts, providers,
 * analytics) only ships to the client if it is a Client Component.
 *
 * See: Project_Docs/Learnings/Phase_0_Setup/02_frontend_scaffold.md
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Load Geist (variable font) and expose it as a CSS custom property so
// Tailwind's --font-sans / --font-mono tokens can reference it in
// `globals.css`. `subsets: ["latin"]` keeps the font file small.
//
// Sans-serif only, everywhere — no display serif pairing. Per the v2
// compact/professional redesign (Anthropic-style product interface),
// weight and size carry the type hierarchy instead of a second typeface.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "EvidenceOS — DORA RoI Copilot",
    template: "%s · EvidenceOS",
  },
  description:
    "AI-powered evidence & validation copilot for EU financial entities preparing their DORA Register of Information.",
  applicationName: "EvidenceOS",
  authors: [{ name: "EvidenceOS" }],
  // We do not want indexing on the marketing pages until we launch.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg">
        {children}
      </body>
    </html>
  );
}
