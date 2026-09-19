import type { ReactNode } from 'react'

interface SkeletonProps {
  /** Tailwind sizing classes, e.g. "h-4 w-32". */
  className?: string
}

/** A single shimmering block. Width/height come from the caller so shapes match the real UI. */
export function Skeleton({ className = 'h-4 w-full' }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-sm bg-surface-3 ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[var(--border)] to-transparent [animation:te-shimmer_1.4s_infinite]" />
    </div>
  )
}

/** N stacked lines, for paragraph-shaped content. */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}

/** Placeholder for a chart frame: axes-ish block plus a legend row. */
export function SkeletonChart({ className = 'h-56' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <Skeleton className="flex-1" />
      <div className="flex gap-3">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  )
}

/** Table placeholder whose row heights match the real dense rows. */
export function SkeletonRows({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-border" aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-3 py-2.5">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={`h-3 ${c === 0 ? 'w-32' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

interface AsyncStateProps {
  /** Describes what is loading, for screen readers. */
  label?: string
  children: ReactNode
}

/** Wraps skeleton content in an aria-busy region so loading is announced, not just seen. */
export function LoadingRegion({ label = 'Loading', children }: AsyncStateProps) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {children}
    </div>
  )
}
