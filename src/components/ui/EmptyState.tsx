import type { ReactNode } from 'react'

import { Button } from './Button'

interface EmptyStateProps {
  title: string
  /** Explains why it's empty and what to do about it. Not filler — say something true. */
  detail?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, detail, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center ${className}`}
    >
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {detail && <p className="max-w-md text-[12px] leading-relaxed text-ink-muted">{detail}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  /** The underlying message — shown in mono so it reads as machine output, not prose. */
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ title = 'Could not load', message, onRetry, className = '' }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center ${className}`}
    >
      <p className="text-[13px] font-medium text-ink">{title}</p>
      <p className="max-w-lg break-words font-mono text-[11.5px] leading-relaxed text-ink-muted">
        {message}
      </p>
      {onRetry && (
        <Button size="sm" className="mt-1" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

/** Compact inline error for a card that has other content worth keeping. */
export function InlineError({ message, className = '' }: { message: string; className?: string }) {
  return (
    <p
      role="alert"
      className={`rounded border border-red-line bg-red-tint px-3 py-2 font-mono text-[11px] leading-relaxed text-red ${className}`}
    >
      {message}
    </p>
  )
}

/**
 * Renders a field the backend does not supply yet. Used for the Pipeline Health signals that
 * need the proposed /api/status extension — an explicit "unavailable" beats a plausible fake.
 */
export function UnavailableState({ label, detail }: { label: string; detail?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</span>
      <span className="text-[12px] text-ink-muted">Not available — requires backend</span>
      {detail && <span className="text-[11px] leading-relaxed text-ink-faint">{detail}</span>}
    </div>
  )
}
