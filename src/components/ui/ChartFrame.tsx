import type { ReactNode } from 'react'

import { EmptyState, ErrorState } from './EmptyState'
import { SkeletonChart } from './Skeleton'

interface ChartFrameProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Height of the plotting area in px; the frame itself sizes to content. */
  height?: number
  loading?: boolean
  error?: string | null
  /** Renders the empty state instead of children. */
  isEmpty?: boolean
  emptyTitle?: string
  emptyDetail?: ReactNode
  onRetry?: () => void
  /** Legend rendered under the plot, outside the chart's own SVG. */
  legend?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Consistent shell around every chart: one place that decides what loading, empty and error
 * look like, so individual charts only describe their plot.
 */
export function ChartFrame({
  title,
  subtitle,
  actions,
  height = 240,
  loading = false,
  error = null,
  isEmpty = false,
  emptyTitle = 'No data yet',
  emptyDetail,
  onRetry,
  legend,
  children,
  className = '',
}: ChartFrameProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-3 ${className}`}>
      {(title !== undefined || actions !== undefined) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title !== undefined && (
              <h3 className="text-[12px] font-semibold text-ink">{title}</h3>
            )}
            {subtitle !== undefined && (
              <p className="mt-0.5 text-[11px] text-ink-muted">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}

      <div style={{ minHeight: height }}>
        {loading ? (
          <SkeletonChart className="h-full" />
        ) : error ? (
          <ErrorState title="Chart unavailable" message={error} onRetry={onRetry} />
        ) : isEmpty ? (
          <EmptyState title={emptyTitle} detail={emptyDetail} />
        ) : (
          children
        )}
      </div>

      {legend && !loading && !error && !isEmpty && <div className="flex flex-wrap gap-4">{legend}</div>}
    </div>
  )
}

interface LegendItemProps {
  color: string
  label: ReactNode
  /** Dashed swatch distinguishes a baseline series from the primary one. */
  dashed?: boolean
}

export function LegendItem({ color, label, dashed = false }: LegendItemProps) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
      {dashed ? (
        <svg width="12" height="2" aria-hidden="true">
          <line x1="0" y1="1" x2="12" y2="1" stroke={color} strokeWidth="2" strokeDasharray="3 2" />
        </svg>
      ) : (
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} aria-hidden="true" />
      )}
      {label}
    </span>
  )
}

/** Shared Recharts axis/grid styling so every chart in the app matches. */
export const CHART_AXIS = {
  tick: { fontSize: 11, fill: 'var(--ink-muted)' },
  tickLine: false,
  axisLine: { stroke: 'var(--border)' },
} as const

export const CHART_GRID = {
  stroke: 'var(--border)',
  strokeDasharray: '3 3',
  vertical: false,
} as const

export const CHART_TOOLTIP_STYLE = {
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  fontSize: 12,
  boxShadow: 'none',
  color: 'var(--ink)',
} as const
