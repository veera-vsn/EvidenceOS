/**
 * See documents/loading.tsx's docstring -- same Suspense-fallback
 * convention, shaped to this page's layout instead.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div className="mx-auto max-w-[1320px] px-5 py-6 pb-20 sm:px-10 sm:py-[34px]">
      <div className="mb-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-6 w-24" />
      </div>

      <Skeleton className="h-[92px] rounded-[13px]" />

      <div className="mt-6 flex flex-col gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[62px] rounded-[13px]" />
        ))}
      </div>
    </div>
  );
}
