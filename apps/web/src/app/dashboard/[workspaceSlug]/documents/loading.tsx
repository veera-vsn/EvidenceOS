/**
 * Next's `loading.tsx` file convention -- automatically wraps this
 * route's page in a Suspense boundary with this fallback while the
 * page's data fetch resolves. No loading state existed anywhere in this
 * app before (2026-07-20 redesign, Phase 3) -- every async page just
 * awaited server-side with a blank screen in between.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentsLoading() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-6 pb-20 sm:px-10 sm:py-[34px]">
      <div className="mb-5 flex items-end justify-between sm:mb-6">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-6 w-32" />
        </div>
        <Skeleton className="h-4 w-28" />
      </div>

      <Skeleton className="h-[124px] rounded-2xl" />

      <div className="mt-8 flex flex-col gap-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border-2 py-3.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
