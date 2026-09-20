import { Link } from 'react-router'

import type { Insight } from '../../lib/insights'
import { Icon } from './Icon'

const DOT_TONE: Record<Insight['tone'], string> = {
  neutral: 'bg-ink-faint',
  positive: 'bg-teal',
  attention: 'bg-amber',
  risk: 'bg-red',
}

/**
 * A row in the findings list.
 *
 * Deliberately plain: a small tone marker, the finding, and a link. The sentence carries the
 * meaning — the marker only reinforces it, so the row still reads correctly in greyscale.
 */
export function InsightCard({ insight }: { insight: Insight }) {
  const body = (
    <>
      <span
        className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[insight.tone]}`}
        aria-hidden="true"
      />

      <span className="min-w-0 flex-1">
        <span className="t-card block text-ink">{insight.title}</span>
        {insight.detail && (
          <span className="t-secondary mt-0.5 block text-ink-muted">{insight.detail}</span>
        )}
      </span>

      {insight.action && (
        <>
          <span className="t-secondary hidden shrink-0 text-blue sm:inline">
            {insight.action.label}
          </span>
          <Icon name="chevronRight" size={14} className="shrink-0 text-ink-faint" />
        </>
      )}
    </>
  )

  const rowClass = 'flex w-full items-start gap-3.5 py-3.5 text-left transition-colors'

  return (
    <li>
      {insight.action ? (
        <Link to={insight.action.to} className={`${rowClass} hover:bg-surface-2`}>
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  )
}

/** The findings list. Hairline-separated rows inside a single card. */
export function InsightList({
  insights,
  className = '',
}: {
  insights: Insight[]
  className?: string
}) {
  if (insights.length === 0) return null

  return (
    <ul className={`divide-y divide-border ${className}`}>
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </ul>
  )
}

/**
 * Numbered variant, for "what stands out" summaries where the order itself is the point
 * (weakest technique first, and so on).
 */
export function NumberedInsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null

  return (
    <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {insights.map((insight, index) => (
        <li
          key={insight.id}
          className="flex items-start gap-4 rounded-lg border border-border bg-surface px-5 py-4"
        >
          <span className="t-card flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-muted">
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="t-card block text-ink">{insight.title}</span>
            {insight.detail && (
              <span className="t-secondary mt-1 block text-ink-muted">{insight.detail}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}
