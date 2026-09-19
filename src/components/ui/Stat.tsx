import type { ReactNode } from 'react'

type StatTone = 'default' | 'detected' | 'miss' | 'red' | 'blue' | 'amber'

const VALUE_TONE: Record<StatTone, string> = {
  default: 'text-ink',
  detected: 'text-teal',
  miss: 'text-miss',
  red: 'text-red',
  blue: 'text-blue',
  amber: 'text-amber',
}

interface StatProps {
  label: ReactNode
  value: ReactNode
  /** Small qualifier under the value — sample size, unit, or an explicit caveat. */
  sub?: ReactNode
  tone?: StatTone
  /** Optional trailing slot, e.g. a sparkline. */
  chart?: ReactNode
  className?: string
}

/** A single headline number. Generous whitespace, tabular figures, no decoration. */
export function Stat({ label, value, sub, tone = 'default', chart, className = '' }: StatProps) {
  return (
    <div className={`flex min-w-0 flex-col justify-between gap-2 px-4 py-3.5 ${className}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>

      <div className="flex items-end justify-between gap-3">
        <p className={`tnum font-mono text-[28px] font-medium leading-none ${VALUE_TONE[tone]}`}>
          {value}
        </p>
        {chart && <div className="shrink-0 pb-0.5">{chart}</div>}
      </div>

      {sub !== undefined && <p className="text-[11px] leading-tight text-ink-muted">{sub}</p>}
    </div>
  )
}

/** Lays out a row of Stats with hairline dividers that collapse on narrow screens. */
export function StatRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`grid grid-cols-2 divide-x divide-y divide-border border-border lg:grid-cols-4 lg:divide-y-0 ${className}`}
    >
      {children}
    </div>
  )
}
