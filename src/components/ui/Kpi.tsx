import type { ReactNode } from 'react'

import { Meter, type MeterTone } from './Meter'

export type KpiTone = 'teal' | 'blue' | 'amber' | 'red' | 'gray'

const VALUE_TONE: Record<KpiTone, string> = {
  teal: 'text-teal',
  blue: 'text-ink',
  amber: 'text-amber',
  red: 'text-red',
  gray: 'text-ink',
}

const METER_FOR: Record<KpiTone, MeterTone> = {
  teal: 'teal',
  blue: 'blue',
  amber: 'amber',
  red: 'red',
  gray: 'blue',
}

interface KpiCardProps {
  label: string
  value: ReactNode
  /** One sentence saying what the number means, not what it is. */
  description?: ReactNode
  /** 0..1 fill. Omit entirely when the value has no meaningful whole to be a fraction of. */
  meter?: number | null
  /** Stated scale for the meter, so the bar can't be misread. */
  meterCaption?: ReactNode
  footer?: ReactNode
  /** Short labels rendered as chips — used instead of a meter where the value is a set. */
  chips?: string[]
  tone?: KpiTone
  className?: string
}

/**
 * A headline metric as a self-contained card.
 *
 * No icon: the label and the number do the work. The description carries the interpretation,
 * which is the part that actually needed adding — the previous version showed the number and
 * left the reader to work out what it meant.
 *
 * A meter appears only when there is a real 0..1 proportion behind it, and the caption then
 * states what the scale is.
 */
export function KpiCard({
  label,
  value,
  description,
  meter,
  meterCaption,
  footer,
  chips,
  tone = 'gray',
  className = '',
}: KpiCardProps) {
  return (
    <div className={`flex flex-col rounded-lg border border-border bg-surface p-5 ${className}`}>
      <p className="t-secondary text-ink-muted">{label}</p>

      <p className={`t-metric mt-2 ${VALUE_TONE[tone]}`}>{value}</p>

      {description && <p className="t-secondary mt-2 text-ink-muted">{description}</p>}

      {meter != null && (
        <Meter value={meter} tone={METER_FOR[tone]} label={`${label} meter`} className="mt-4" />
      )}

      {meterCaption && <p className="t-secondary mt-1.5 text-ink-faint">{meterCaption}</p>}

      {chips && chips.length > 0 && (
        <ul className="mt-3.5 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <li
              key={chip}
              className="t-technical rounded border border-border bg-surface-2 px-1.5 py-0.5 text-ink-muted"
            >
              {chip}
            </li>
          ))}
        </ul>
      )}

      {footer && <div className="t-secondary mt-auto pt-4 text-ink-faint">{footer}</div>}
    </div>
  )
}

/** Responsive row of KpiCards. */
export function KpiGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {children}
    </div>
  )
}

/** Card header text, with an optional one-line context. */
export function CardHeading({
  title,
  subtitle,
}: {
  title: ReactNode
  subtitle?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <h2 className="t-card text-ink">{title}</h2>
      {subtitle && <p className="t-secondary mt-0.5 text-ink-muted">{subtitle}</p>}
    </div>
  )
}
