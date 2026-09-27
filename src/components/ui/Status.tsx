import type { ReactNode } from 'react'

export type ServiceState = 'up' | 'down' | 'degraded' | 'unknown'

const STATE_META: Record<ServiceState, { dot: string; label: string }> = {
  up: { dot: 'bg-teal', label: 'Reachable' },
  down: { dot: 'bg-red', label: 'Unreachable' },
  degraded: { dot: 'bg-amber', label: 'Degraded' },
  unknown: { dot: 'bg-ink-faint', label: 'Unknown' },
}

interface StatusRowProps {
  /**
   * `label` overrides the generic state wording. Some rows are not about reachability at all —
   * a Caldera agent can be reachable and still untrusted, and calling that "Unreachable" would
   * describe the wrong failure.
   */
  services: { name: string; state: ServiceState; label?: string; detail?: string }[]
  className?: string
}

/**
 * Compact service status strip.
 *
 * Each entry carries a text label as well as a coloured dot, so status survives greyscale,
 * colour-blindness and a bad projector. The accessible name states the same thing again.
 */
export function StatusRow({ services, className = '' }: StatusRowProps) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${className}`}>
      {services.map((service) => {
        const meta = STATE_META[service.state]
        const label = service.label ?? meta.label
        return (
          <li
            key={service.name}
            className="flex items-center gap-2"
            aria-label={`${service.name}: ${label}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
            <span className="t-body text-ink">{service.name}</span>
            <span className="t-secondary text-ink-muted">{label}</span>
            {service.detail && <span className="t-technical text-ink-faint">{service.detail}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The single overall verdict shown at the top of a status surface.
 * Colour is a reinforcement here — the words carry the meaning.
 */
export function VerdictBanner({
  state,
  headline,
  detail,
  children,
}: {
  state: ServiceState
  headline: string
  detail?: ReactNode
  children?: ReactNode
}) {
  const meta = STATE_META[state]

  return (
    <div className="border-b border-border pb-5">
      <p className="flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
        <span className="t-section text-ink">{headline}</span>
      </p>
      {detail && <p className="t-body mt-1.5 pl-5 text-ink-muted">{detail}</p>}
      {children && <div className="mt-4 pl-5">{children}</div>}
    </div>
  )
}
