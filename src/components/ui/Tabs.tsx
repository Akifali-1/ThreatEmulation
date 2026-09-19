import type { ReactNode } from 'react'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  /** Optional count pill, e.g. pending proposals. */
  count?: number
}

interface TabsProps<T extends string> {
  value: T
  items: TabItem<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

/**
 * Underline tabs. Implemented with roving arrow-key navigation per the ARIA tabs pattern so
 * filter switching works without a mouse.
 */
export function Tabs<T extends string>({
  value,
  items,
  onChange,
  ariaLabel,
  className = '',
}: TabsProps<T>) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.value === value)
    if (index === -1) return

    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return

    event.preventDefault()
    onChange(items[next].value)
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`flex items-center gap-1 border-b border-border ${className}`}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-medium transition-colors ${
              active
                ? 'border-blue text-ink'
                : 'border-transparent text-ink-muted hover:border-border-strong hover:text-ink'
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="tnum rounded bg-surface-3 px-1.5 text-[10.5px] font-medium text-ink-muted">
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
