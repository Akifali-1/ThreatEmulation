import { ALPHA, formatP } from '../../lib/metrics/mannwhitney'
import { formatOddsRatio, type FisherResult } from '../../lib/metrics/fisher'
import { Badge } from '../ui/Badge'

interface EvasionTestProps {
  result: FisherResult | null
  /** e.g. "Static baseline" */
  labelA: string
  /** e.g. "Agentic" */
  labelB: string
}

/**
 * Fisher's exact test on detected-vs-missed counts.
 *
 * This is the primary outcome. Mann-Whitney compares how fast detections happened and can only
 * see trials that were detected; a technique that evaded completely contributes nothing to it.
 * Whether a technique was evaded at all is a proportion, and a proportion between two groups
 * is what Fisher's exact test answers.
 */
export function EvasionTest({ result, labelA, labelB }: EvasionTestProps) {
  if (!result || result.n === 0) {
    return (
      <p className="text-[12px] leading-relaxed text-ink-muted">
        Not enough trials in both groups to run the test.
      </p>
    )
  }

  const { table } = result

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={result.significant ? 'detected' : 'neutral'}>
          {result.significant ? 'Significant' : 'Not significant'}
        </Badge>
        <span className="tnum font-mono text-[11.5px] text-ink-muted">
          {formatP(result.p)} · α = {ALPHA}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <RateCell label={labelA} detected={table.a} total={table.a + table.b} rate={result.rateA} />
        <RateCell label={labelB} detected={table.c} total={table.c + table.d} rate={result.rateB} />
      </div>

      <div className="border-t border-border pt-3">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <dt className="text-[10.5px] uppercase tracking-wide text-ink-faint">Odds ratio</dt>
            <dd className="tnum mt-0.5 font-mono text-[15px] text-ink">
              {formatOddsRatio(result.oddsRatio)}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-wide text-ink-faint">Total trials</dt>
            <dd className="tnum mt-0.5 font-mono text-[15px] text-ink">{result.n}</dd>
          </div>
        </dl>
      </div>

      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        {result.significant ? (
          <>
            The detection rates differ significantly between {labelA} and {labelB}. The odds of a
            trial being detected are {formatOddsRatio(result.oddsRatio)}× higher in {labelA}.
          </>
        ) : (
          <>
            There is <strong className="font-medium text-ink">no statistically significant
            difference</strong> in detection rate between {labelA} ({table.a}/{table.a + table.b})
            and {labelB} ({table.c}/{table.c + table.d}). The observed gap is consistent with chance
            at this sample size, so it should not be reported as an effect.
          </>
        )}
      </p>

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        Underpowered: the two groups are unbalanced and small, so a non-significant result is the
        expected outcome even if a real difference exists — treat it as inconclusive rather than as
        evidence of no effect.
      </p>

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        Note: because the Red Agent selects techniques based on prior trial outcomes, trials are not
        fully independent draws, so this p-value should be read as indicative rather than a strict
        significance test.
      </p>
    </div>
  )
}

const TONE = { detected: 'text-teal', miss: 'text-miss' } as const

function RateCell({
  label,
  detected,
  total,
  rate,
}: {
  label: string
  detected: number
  total: number
  rate: number
}) {
  const tone = rate >= 0.5 ? 'detected' : 'miss'
  return (
    <div className="rounded border border-border p-3">
      <p className="text-[11px] font-medium text-ink-muted">{label}</p>
      <p className={`tnum mt-1 font-mono text-[20px] leading-none ${TONE[tone]}`}>
        {(rate * 100).toFixed(1)}%
      </p>
      <p className="tnum mt-1 font-mono text-[11px] text-ink-faint">
        {detected} detected / {total - detected} missed
      </p>
    </div>
  )
}
