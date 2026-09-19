import { useId, useState, type ReactNode } from 'react'

import { Icon } from './Icon'

interface DisclosureProps {
  /** The affordance text, e.g. "How is this calculated?" or "View statistical details". */
  summary: string
  children: ReactNode
  /** Open on mount, for details that should be visible by default. */
  defaultOpen?: boolean
  className?: string
}

/**
 * Progressive disclosure.
 *
 * The mechanism that lets a page lead with a plain-language answer while keeping the full
 * technical explanation one click away. Used for methodology, statistical caveats, raw
 * endpoints and metric definitions — never for critical operational status, which stays
 * visible unconditionally.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className = '',
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue transition-colors hover:text-brand-dark"
      >
        <Icon
          name="chevronRight"
          size={13}
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {summary}
      </button>

      {open && (
        <div id={panelId} className="mt-2.5 space-y-2.5 border-l-2 border-border pl-3.5">
          {children}
        </div>
      )}
    </div>
  )
}

/** Body copy inside a disclosure — smaller and quieter than the page's primary text. */
export function DisclosureText({ children }: { children: ReactNode }) {
  return <p className="t-secondary max-w-3xl text-ink-muted">{children}</p>
}

/** Definition-style row inside a disclosure, for methodology parameters. */
export function DisclosureRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-40 shrink-0 text-[12.5px] text-ink-faint">{term}</dt>
      <dd className="t-secondary text-ink-muted">{children}</dd>
    </div>
  )
}
