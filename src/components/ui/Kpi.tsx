import type { ReactNode } from 'react'

type KpiTone = 'neutral' | 'positive' | 'attention' | 'risk'

const VALUE_TONE: Record<KpiTone, string> = {
  neutral: 'text-ink',
  positive: 'text-teal',
  attention: 'text-amber',
  risk: 'text-red',
}

interface KpiProps {
  /** Plain-language label. No uppercase, no initialisms. */
  label: string
  value: ReactNode
  /** The reading of the number — what it means, not what it is. */
  interpretation?: ReactNode
  /** The raw counts behind it, where they add credibility. */
  evidence?: ReactNode
  tone?: KpiTone
  className?: string
}

/**
 * A primary metric.
 *
 * Three layers, in order of decreasing prominence: the number, what it means in a sentence,
 * and the raw counts. The interpretation line is the point of the component — a dashboard
 * that shows "63.6%" and stops has moved the analytical work onto the reader.
 */
export function Kpi({ label, value, interpretation, evidence, tone = 'neutral', className = '' }: KpiProps) {
  return (
    <div className={`flex flex-col gap-1.5 px-5 py-4 ${className}`}>
      <p className="t-secondary text-ink-muted">{label}</p>
      <p className={`t-metric mt-0.5 ${VALUE_TONE[tone]}`}>{value}</p>
      {interpretation && <p className="t-secondary text-ink">{interpretation}</p>}
      {evidence && <p className="t-technical text-ink-faint">{evidence}</p>}
    </div>
  )
}

/** Lays out primary metrics with hairline dividers that collapse on narrow screens. */
export function KpiRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 ${className}`}
    >
      {children}
    </div>
  )
}
