import type { ReactNode } from 'react'

/**
 * Tone names map to the token triples in tokens.css (base / tint / line). Adding a tone here
 * means adding the same triple there — components never invent colours inline.
 */
export type BadgeTone =
  | 'neutral'
  | 'red'
  | 'blue'
  | 'detected'
  | 'miss'
  | 'pending'
  | 'info'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-muted border-border-strong',
  red: 'bg-red-tint text-red border-red-line',
  blue: 'bg-blue-tint text-blue border-blue-line',
  detected: 'bg-teal-tint text-teal border-teal-line',
  // A miss is a finding, not a failure — deliberately the quietest badge in the set.
  miss: 'bg-miss-tint text-miss border-miss-line',
  pending: 'bg-amber-tint text-amber border-amber-line',
  info: 'bg-blue-tint text-blue border-blue-line',
}

const DOTS: Record<BadgeTone, string> = {
  neutral: 'bg-ink-faint',
  red: 'bg-red',
  blue: 'bg-blue',
  detected: 'bg-teal',
  miss: 'bg-miss',
  pending: 'bg-amber',
  info: 'bg-blue',
}

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  /** Renders a small leading status dot. */
  dot?: boolean
  className?: string
}

export function Badge({ tone = 'neutral', children, dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[tone]}`} />}
      {children}
    </span>
  )
}
