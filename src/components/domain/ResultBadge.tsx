import { Badge } from '../ui/Badge'
import { formatSeconds, pluralAlerts } from '../../lib/format'

/**
 * Detection outcome.
 *
 * A miss is deliberately the quietest thing on the page — gray, never red, and never worded
 * as a failure. In this project an evasion is a result, not an error.
 */
export function ResultBadge({ detected, className = '' }: { detected: boolean; className?: string }) {
  return (
    <Badge tone={detected ? 'detected' : 'miss'} dot className={className}>
      {detected ? 'Detected' : 'Not detected'}
    </Badge>
  )
}

/** Compact outcome for dense log lines and table cells. */
export function ResultInline({
  detected,
  timeToDetect,
  numAlerts,
}: {
  detected: boolean
  timeToDetect?: number | null
  numAlerts?: number | null
}) {
  if (!detected) {
    return (
      <span className="tnum font-mono text-[11.5px] font-medium text-miss">
        Not detected · {pluralAlerts(numAlerts ?? 0)}
      </span>
    )
  }

  return (
    <span className="tnum font-mono text-[11.5px] font-medium text-teal">
      Detected
      {typeof timeToDetect === 'number' ? ` in ${formatSeconds(timeToDetect)}` : ''}
      {numAlerts != null ? ` · ${pluralAlerts(numAlerts)}` : ''}
    </span>
  )
}
