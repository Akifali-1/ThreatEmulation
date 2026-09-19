import {
  ALPHA,
  effectMagnitude,
  formatP,
  type MannWhitneyResult,
} from '../../lib/metrics/mannwhitney'
import { Badge } from '../ui/Badge'

interface SignificanceNoteProps {
  result: MannWhitneyResult | null
  /** What group A is, e.g. "Static baseline". */
  labelA: string
  /** What group B is, e.g. "Agentic". */
  labelB: string
  /** What the measured quantity is, e.g. "time to detect". */
  measure: string
}

/**
 * States the Mann-Whitney outcome in plain language.
 *
 * The rule here is that a non-significant result is reported as such, in the same visual
 * weight as a significant one. Overstating a p of 0.31 would be the single easiest way to
 * misrepresent this project's findings.
 */
export function SignificanceNote({ result, labelA, labelB, measure }: SignificanceNoteProps) {
  if (!result) {
    return (
      <p className="text-[12px] leading-relaxed text-ink-muted">
        Not enough data in one of the groups to run the test. Both {labelA} and {labelB} need at
        least one {measure} observation.
      </p>
    )
  }

  const magnitude = effectMagnitude(result.rankBiserial)

  if (!result.significant) {
    return (
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Not significant</Badge>
          <span className="tnum font-mono text-[11.5px] text-ink-muted">
            {formatP(result.p)} · α = {ALPHA}
          </span>
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          There is <strong className="font-medium text-ink">no statistically significant
          difference</strong> in {measure} between {labelA} (n = {result.n1}) and {labelB} (n ={' '}
          {result.n2}). The observed difference is consistent with chance at this sample size —
          it should not be reported as an effect. Effect size is {magnitude} (
          {result.rankBiserial.toFixed(2)}).
        </p>
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          More trials would be needed to detect a difference of this size, if one exists.
        </p>
      </div>
    )
  }

  const direction =
    result.rankBiserial > 0
      ? `values in ${labelA} tend to be higher than in ${labelB}`
      : `values in ${labelB} tend to be higher than in ${labelA}`

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="detected">Significant</Badge>
        <span className="tnum font-mono text-[11.5px] text-ink-muted">
          {formatP(result.p)} · α = {ALPHA}
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        {labelA} (n = {result.n1}) and {labelB} (n = {result.n2}) differ significantly in{' '}
        {measure}: {direction}. Effect size is {magnitude} (
        {result.rankBiserial.toFixed(2)}).
      </p>
      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        Mann-Whitney U = {result.u.toFixed(1)}, z = {result.z.toFixed(2)}, two-tailed.
      </p>
    </div>
  )
}

/** One-line stat readout for a card header. */
export function SignificanceStat({ result }: { result: MannWhitneyResult | null }) {
  if (!result) return <span className="text-[11.5px] text-ink-faint">insufficient data</span>
  return (
    <span className="tnum font-mono text-[11.5px] text-ink-muted">
      U = {result.u.toFixed(1)} · {formatP(result.p)}
    </span>
  )
}
