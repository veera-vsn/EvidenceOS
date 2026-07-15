/**
 * Route group wrapper for the auth pages (`/login`, `/signup`).
 *
 * The parentheses in the route-group name `(auth)` mean the folder
 * does NOT appear in the URL — it just lets us hang a shared layout
 * off a group of routes without moving them under a common segment.
 *
 * No shared chrome here: each auth page renders its own full-viewport
 * two-column shell (brand rail + form), since the two pages' brand
 * rails carry different headline copy and Next.js layouts can't take
 * per-page props — matching a plain passthrough is simpler than
 * fighting that constraint for two pages.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
