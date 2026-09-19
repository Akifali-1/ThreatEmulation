import type { ReactNode } from 'react'

import { SectionHeading } from '../layout/PageHeader'

interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  /**
   * `card` draws a border — use for genuinely self-contained objects like a proposal.
   * `section` drops the border entirely and groups by heading and whitespace, which is the
   * default posture in this UI. Too many nested borders is what made the old layout feel
   * like a database.
   */
  variant?: 'card' | 'section'
  className?: string
  bodyClassName?: string
  /** Removes body padding — for content that is a table or a flush chart. */
  flush?: boolean
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  variant = 'section',
  className = '',
  bodyClassName = '',
  flush = false,
}: CardProps) {
  const hasHeading = title !== undefined || subtitle !== undefined || actions !== undefined

  if (variant === 'section') {
    return (
      <section className={`flex min-w-0 flex-col ${className}`}>
        {hasHeading && (
          <SectionHeading title={title ?? ''} description={subtitle} actions={actions} className="mb-3" />
        )}
        <div className={`flex min-h-0 flex-1 flex-col ${bodyClassName}`}>{children}</div>
      </section>
    )
  }

  return (
    <section
      className={`flex min-w-0 flex-col rounded-lg border border-border bg-surface ${className}`}
    >
      {hasHeading && (
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            {title !== undefined && <h2 className="t-card text-ink">{title}</h2>}
            {subtitle !== undefined && (
              <p className="t-secondary mt-1 text-ink-muted">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`flex min-h-0 flex-1 flex-col ${flush ? '' : 'px-5 pb-5'} ${bodyClassName}`}>
        {children}
      </div>
    </section>
  )
}
