import { Link } from 'react-router'

import type { Insight } from '../../lib/insights'
import { Icon } from './Icon'

const TONE = {
  neutral: { dot: 'bg-ink-faint', text: 'text-ink' },
  positive: { dot: 'bg-teal', text: 'text-ink' },
  attention: { dot: 'bg-amber', text: 'text-ink' },
  risk: { dot: 'bg-red', text: 'text-ink' },
} as const

/**
 * A plain-language finding derived from the data.
 *
 * Never a ranking or an arbitrary score — every insight restates a measurement that exists.
 * The tone only controls the marker colour; the sentence itself carries the meaning, so the
 * card is still readable in greyscale or by someone who cannot distinguish the hues.
 */
export function InsightCard({ insight }: { insight: Insight }) {
  const tone = TONE[insight.tone]

  return (
    <div className="flex gap-3 py-3">
      <span
        className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className={`t-card ${tone.text}`}>{insight.title}</p>
        {insight.detail && <p className="t-secondary mt-0.5 text-ink-muted">{insight.detail}</p>}
        {insight.action && (
          <Link
            to={insight.action.to}
            className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-blue hover:text-brand-dark"
          >
            {insight.action.label}
            <Icon name="chevronRight" size={12} />
          </Link>
        )}
      </div>
    </div>
  )
}

/** A stack of findings separated by hairlines. Replaces the old explanatory paragraph. */
export function InsightList({ insights, className = '' }: { insights: Insight[]; className?: string }) {
  if (insights.length === 0) return null

  return (
    <div className={`divide-y divide-border ${className}`}>
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  )
}
