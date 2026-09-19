import { describeTechnique, techniqueLabel } from '../../lib/techniques'

interface TechniqueLabelProps {
  technique: string
  /** `stacked` puts the ATT&CK name under the ID; `inline` keeps one line. */
  variant?: 'inline' | 'stacked'
  className?: string
}

/**
 * Renders a technique as its ATT&CK ID plus human name.
 *
 * The API only returns Caldera's ability name (`Test-Registry`), so the ID comes from the
 * frontend mapping. An unmapped ability still renders — it shows the raw name and no ID
 * rather than being hidden.
 */
export function TechniqueLabel({ technique, variant = 'inline', className = '' }: TechniqueLabelProps) {
  const meta = describeTechnique(technique)

  if (!meta.mapped) {
    return (
      <span className={`font-mono text-[11.5px] text-ink ${className}`} title="No ATT&CK mapping defined">
        {meta.raw}
      </span>
    )
  }

  if (variant === 'stacked') {
    return (
      <span className={`flex min-w-0 flex-col ${className}`}>
        <span className="flex items-baseline gap-2">
          <span className="tnum shrink-0 font-mono text-[11.5px] font-medium text-blue">
            {meta.mitreId}
          </span>
          <span className="truncate text-[12px] text-ink">{meta.name}</span>
        </span>
        <span className="mt-0.5 text-[10.5px] text-ink-faint">{meta.tactic}</span>
      </span>
    )
  }

  return (
    <span className={`flex min-w-0 items-baseline gap-2 ${className}`}>
      <span className="tnum shrink-0 font-mono text-[11.5px] font-medium text-blue">
        {meta.mitreId}
      </span>
      <span className="truncate text-[12px] text-ink">{meta.name}</span>
    </span>
  )
}

/** Plain-text form for CSV exports, axis labels and tooltips. */
export function techniquePlainText(technique: string): string {
  const meta = describeTechnique(technique)
  return meta.mapped ? `${meta.mitreId} ${meta.name}` : meta.raw
}

export { techniqueLabel }
