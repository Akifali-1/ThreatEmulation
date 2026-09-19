import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  /** One short contextual sentence. Not three. */
  description?: ReactNode
  actions?: ReactNode
}

/**
 * Page opening.
 *
 * Deliberately minimal: a title, one sentence, optional actions. The old version also carried
 * a row of uppercase label/value facts, which duplicated what the page body already said and
 * competed with the page's actual answer for attention.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-6 pb-6 pt-7 lg:px-8">
      <div className="min-w-0">
        <h1 className="t-page text-ink">{title}</h1>
        {description && <p className="t-body mt-2 max-w-2xl text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

interface SectionHeadingProps {
  title: ReactNode
  /** Optional one-line context. Used sparingly — most sections need none. */
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Heading for a group of content.
 *
 * Prefer this over boxing a section in another card. Grouping by whitespace and a heading
 * reads more calmly than nesting bordered containers.
 */
export function SectionHeading({ title, description, actions, className = '' }: SectionHeadingProps) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${className}`}>
      <div className="min-w-0">
        <h2 className="t-section text-ink">{title}</h2>
        {description && <p className="t-secondary mt-0.5 text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
