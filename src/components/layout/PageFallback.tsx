import { Skeleton, SkeletonChart } from '../ui/Skeleton'

/**
 * Suspense fallback for lazy routes. Mirrors the shape of a typical page — title block, a KPI
 * strip, then a chart — so the layout doesn't jump when the real page mounts.
 */
export function PageFallback() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <div className="border-b border-border px-5 py-4 lg:px-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2.5 h-3 w-96" />
      </div>
      <div className="space-y-4 p-5 lg:p-6">
        <Skeleton className="h-24 w-full" />
        <SkeletonChart className="h-64" />
      </div>
    </div>
  )
}
