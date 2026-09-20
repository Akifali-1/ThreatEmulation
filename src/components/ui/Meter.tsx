export type MeterTone = 'teal' | 'blue' | 'amber' | 'red'

const METER_TONES: Record<MeterTone, string> = {
  teal: 'bg-teal',
  blue: 'bg-blue',
  amber: 'bg-amber',
  red: 'bg-red',
}

interface MeterProps {
  /** Fill as a 0..1 ratio. */
  value: number
  tone?: MeterTone
  /** Accessible description; the bar itself carries no text. */
  label: string
  className?: string
}

/**
 * Thin progress bar.
 *
 * Only used where the value is genuinely a proportion of a known whole. It is never used to
 * imply a scale that doesn't exist — an invented percentage is worse than no bar at all.
 */
export function Meter({ value, tone = 'blue', label, className = '' }: MeterProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100

  return (
    <div
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-3 ${className}`}
    >
      <div
        className={`h-full rounded-full ${METER_TONES[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
