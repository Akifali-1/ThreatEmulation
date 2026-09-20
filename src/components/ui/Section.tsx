import type { ReactNode } from 'react'

interface SectionProps {
  /** Small utility label above the heading, e.g. "Approach". */
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * A top-level page section: optional eyebrow, heading, one line of context, then content.
 *
 * The eyebrow is the only uppercase text in the app, and it is confined to this one job —
 * labelling a group. Everything else uses size and weight for hierarchy.
 */
export function Section({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = '',
}: SectionProps) {
  return (
    <section className={`border-t border-border pt-7 ${className}`}>
      {eyebrow && (
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
          {eyebrow}
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 className="t-page text-ink">{title}</h2>
          {description && (
            <p className="t-body mt-1.5 max-w-2xl text-ink-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  )
}

/** Muted callout for a note that qualifies the section above it. */
export function Callout({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border-l-2 border-blue-line bg-surface-2 px-4 py-3 t-body text-ink-muted">
      {children}
    </p>
  )
}

/**
 * Two-column definition list used to compare configurations side by side.
 * Rows are hairline-separated rather than boxed, so the values line up across columns.
 */
export function DefinitionList({
  items,
  className = '',
}: {
  items: { term: string; value: ReactNode }[]
  className?: string
}) {
  return (
    <dl className={`divide-y divide-border border-t border-border ${className}`}>
      {items.map((item) => (
        <div key={item.term} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="t-secondary text-ink-muted">{item.term}</dt>
          <dd className="t-secondary text-right text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
