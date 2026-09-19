import { formatEps, type EpsHalves } from '../../lib/metrics/eps'
import { Badge } from '../ui/Badge'

/**
 * EPS display.
 *
 * The score is unbounded below (a technique detected early and never late can go well past
 * -1), so the bar is clamped to ±1 while the printed value stays exact. Positive = detection
 * fell off over the campaign = the agent's evasion persisted.
 */
const CLAMP = 1

interface EpsValueProps {
  eps: number | null
  className?: string
}

export function EpsValue({ eps, className = '' }: EpsValueProps) {
  if (eps === null) {
    return (
      <span className={`text-[11.5px] text-ink-faint ${className}`} title="Fewer than 4 trials">
        insufficient data
      </span>
    )
  }

  const tone = eps > 0.05 ? 'text-red' : eps < -0.05 ? 'text-blue' : 'text-ink-muted'

  return (
    <span className={`tnum font-mono text-[12px] font-medium ${tone} ${className}`}>
      {formatEps(eps)}
    </span>
  )
}

export function EpsBadge({ eps }: { eps: number | null }) {
  if (eps === null) {
    return <Badge tone="neutral">EPS — insufficient data</Badge>
  }
  if (eps > 0.05) return <Badge tone="red">EPS {formatEps(eps)} · evasion persisted</Badge>
  if (eps < -0.05) return <Badge tone="blue">EPS {formatEps(eps)} · detection improved</Badge>
  return <Badge tone="neutral">EPS {formatEps(eps)} · no change</Badge>
}

/** Diverging bar centred on zero. */
export function EpsMeter({ eps, className = '' }: EpsValueProps) {
  if (eps === null) {
    return <span className="text-[11px] text-ink-faint">insufficient data</span>
  }

  const clamped = Math.max(-CLAMP, Math.min(CLAMP, eps))
  const widthPct = Math.abs(clamped) * 50
  const positive = clamped >= 0

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-2 w-24 shrink-0 rounded-sm bg-surface-3">
        <span className="absolute inset-y-0 left-1/2 w-px bg-border-strong" aria-hidden="true" />
        <span
          className={`absolute inset-y-0 ${positive ? 'bg-red' : 'bg-blue'}`}
          style={
            positive
              ? { left: '50%', width: `${widthPct}%` }
              : { right: '50%', width: `${widthPct}%` }
          }
          aria-hidden="true"
        />
      </div>
      <EpsValue eps={eps} />
    </div>
  )
}

/** The early/late rates behind a score, for tooltips and the technique detail view. */
export function EpsBreakdown({ halves }: { halves: EpsHalves | null }) {
  if (!halves) {
    return (
      <p className="text-[11.5px] text-ink-faint">
        EPS needs at least 4 trials for a technique before the early/late split is meaningful.
      </p>
    )
  }

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
      <Metric
        label={`Early (${halves.earlyCount} trials)`}
        value={formatRate(halves.earlyRate)}
      />
      <Metric label={`Late (${halves.lateCount} trials)`} value={formatRate(halves.lateRate)} />
    </dl>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="tnum mt-0.5 font-mono text-[15px] text-ink">{value}</dd>
    </div>
  )
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

