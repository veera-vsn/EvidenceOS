/**
 * See documents/loading.tsx's docstring -- same Suspense-fallback
 * convention, shaped to this page's layout instead.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function ReviewLoading() {
  return (
    <div className="mx-auto max-w-[1000px] px-5 py-6 pb-20 sm:px-10 sm:py-[34px]">
      <div className="mb-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-6 w-32" />
      </div>
      <Skeleton className="mt-3 mb-[22px] h-4 w-2/3" />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-[11px]" />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
