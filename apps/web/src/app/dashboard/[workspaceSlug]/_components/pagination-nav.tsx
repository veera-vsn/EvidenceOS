/**
 * Shared pagination control for list pages (Documents, Pipeline run
 * history). Plain `<Link>`s to `?page=N` -- no client JS, consistent
 * with the rest of this dashboard's server-rendered pages (see the
 * Pipeline page's own note about using native <details> instead of a
 * client-side accordion for the same reason).
 */

import Link from "next/link";

interface PaginationNavProps {
  /** 1-indexed current page. */
  page: number;
  totalPages: number;
  /** Base path, e.g. `/dashboard/acme/documents` -- `?page=N` is appended. */
  basePath: string;
}

export function PaginationNav({ page, totalPages, basePath }: PaginationNavProps) {
  if (totalPages <= 1) return null;

  const prevHref = page > 1 ? `${basePath}?page=${page - 1}` : null;
  const nextHref = page < totalPages ? `${basePath}?page=${page + 1}` : null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-5 flex items-center justify-between border-t border-border-2 pt-4 text-[12.5px]"
    >
      {prevHref ? (
        <Link
          href={prevHref}
          className="rounded-[8px] border border-border px-3 py-1.5 font-medium text-fg-2 transition hover:border-accent-line hover:text-fg"
        >
          ← Previous
        </Link>
      ) : (
        <span className="rounded-[8px] border border-border-2 px-3 py-1.5 font-medium text-fg-3 opacity-40">
          ← Previous
        </span>
      )}

      <span className="font-mono text-fg-3">
        Page {page} of {totalPages}
      </span>

      {nextHref ? (
        <Link
          href={nextHref}
          className="rounded-[8px] border border-border px-3 py-1.5 font-medium text-fg-2 transition hover:border-accent-line hover:text-fg"
        >
          Next →
        </Link>
      ) : (
        <span className="rounded-[8px] border border-border-2 px-3 py-1.5 font-medium text-fg-3 opacity-40">
          Next →
        </span>
      )}
    </nav>
  );
}
