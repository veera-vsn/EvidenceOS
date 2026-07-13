/**
 * Shared visual chrome for the auth pages (`/login`, `/signup`).
 *
 * The parentheses in the route-group name `(auth)` mean the folder
 * does NOT appear in the URL — it just lets us hang a shared layout
 * off a group of routes without moving them under a common segment.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
