/**
 * A single shimmer block. Nothing in this app had any loading-state
 * convention before this (every async page just awaited server-side
 * with no Suspense boundary) -- see 2026-07-20 redesign, Phase 1.
 *
 * Compose multiple Skeletons to match a real layout's shape (a row of
 * skeletons sized to a table's real column widths, for example) rather
 * than a single generic block -- see the design skill's loading-state
 * guidance. `motion-safe:` keeps the pulse off for
 * prefers-reduced-motion users.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div aria-hidden="true" className={`rounded-md bg-surface-2 motion-safe:animate-pulse ${className}`} />;
}
