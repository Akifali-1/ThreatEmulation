import { useMemo } from 'react'
import { Link } from 'react-router'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
  ChartFrame,
  LegendItem,
} from '../components/ui/ChartFrame'
import { Disclosure, DisclosureRow, DisclosureText } from '../components/ui/Disclosure'
import { EmptyState, ErrorState } from '../components/ui/EmptyState'
import { useTrialsData } from '../hooks/useTrialsData'
import { formatCount, formatPct, formatSeconds } from '../lib/format'
import { detectedTtDs, ecdf, quantiles } from '../lib/metrics/distribution'
import { fisherFromCounts, formatOddsRatio } from '../lib/metrics/fisher'
import { ALPHA, effectMagnitude, formatP, mannWhitneyU } from '../lib/metrics/mannwhitney'
import { aggregateTrials, rollupByTechnique } from '../lib/metrics/tpr'
import { compareTechniques, describeTechnique } from '../lib/techniques'

const SERIES = { agentic: 'var(--series-agentic)', static: 'var(--series-static)' } as const

/**
 * Agentic against the static baseline.
 *
 * The page leads with the two numbers being compared and one line saying whether the gap is
 * statistically supported. Every caveat, test statistic and assumption is retained in full —
 * moved behind "View statistical details" rather than deleted, so the page can be read in
 * five seconds without losing anything an examiner would ask for.
 */
export default function Compare() {
  const agentic = useTrialsData('agentic')
  const baseline = useTrialsData('static')

  const loading = agentic.loading || baseline.loading
  const error = agentic.error ?? baseline.error

  const statsA = useMemo(() => aggregateTrials(agentic.trials), [agentic.trials])
  const statsS = useMemo(() => aggregateTrials(baseline.trials), [baseline.trials])

  const evasion = useMemo(
    () => fisherFromCounts(statsS.detected, statsS.totalTrials, statsA.detected, statsA.totalTrials),
    [statsS, statsA],
  )

  const ttdAgentic = useMemo(() => detectedTtDs(agentic.trials), [agentic.trials])
  const ttdStatic = useMemo(() => detectedTtDs(baseline.trials), [baseline.trials])
  const latency = useMemo(() => mannWhitneyU(ttdStatic, ttdAgentic), [ttdStatic, ttdAgentic])

  const cdf = useMemo(() => {
    const a = ecdf(ttdAgentic)
    const s = ecdf(ttdStatic)
    const xs = [...new Set([...a.map((p) => p.x), ...s.map((p) => p.x)])].sort((x, y) => x - y)

    const stepAt = (points: { x: number; y: number }[], x: number): number | null => {
      let value: number | null = null
      for (const point of points) {
        if (point.x <= x) value = point.y
        else break
      }
      return value
    }

    return xs
      .filter((x) => x <= 60)
      .map((x) => ({ x, label: `${x.toFixed(0)}s`, agentic: stepAt(a, x), static: stepAt(s, x) }))
  }, [ttdAgentic, ttdStatic])

  const perTechnique = useMemo(() => {
    const keys = new Set([
      ...agentic.trials.map((t) => t.technique),
      ...baseline.trials.map((t) => t.technique),
    ])
    const rollupA = new Map(rollupByTechnique(agentic.trials).map((r) => [r.technique, r]))
    const rollupS = new Map(rollupByTechnique(baseline.trials).map((r) => [r.technique, r]))

    return [...keys]
      .map((key) => {
        const meta = describeTechnique(key)
        const a = rollupA.get(key)
        const s = rollupS.get(key)
        return {
          key,
          label: meta.mitreId || key,
          full: meta.mapped ? `${meta.mitreId} ${meta.name}` : key,
          agentic: a?.tpr ?? null,
          static: s?.tpr ?? null,
          nAgentic: a?.n ?? 0,
          nStatic: s?.n ?? 0,
        }
      })
      .sort((a, b) => compareTechniques(a.key, b.key))
  }, [agentic.trials, baseline.trials])

  const qA = useMemo(() => quantiles(ttdAgentic), [ttdAgentic])
  const qS = useMemo(() => quantiles(ttdStatic), [ttdStatic])

  const rateA = statsS.totalTrials > 0 ? statsS.detected / statsS.totalTrials : null
  const rateB = statsA.totalTrials > 0 ? statsA.detected / statsA.totalTrials : null

  /** One sentence. No caveats — those live behind the disclosure. */
  const verdict = evasion
    ? evasion.significant
      ? 'The two groups differ by more than chance would explain.'
      : 'The difference between the groups is within what chance would produce at this sample size.'
    : null

  return (
    <>
      <PageHeader
        title="Compare"
        description="The agentic red agent against the static baseline. The question is whether adaptation changed detection."
      />

      <div className="space-y-8 px-6 pb-12 lg:px-8">
        {error ? (
          <Card variant="card" title="Could not load results">
            <ErrorState
              message={error}
              onRetry={() => {
                agentic.refetch()
                baseline.refetch()
              }}
              className="py-8"
            />
          </Card>
        ) : loading ? (
          <Card variant="card">
            <EmptyState title="Loading comparison…" />
          </Card>
        ) : (
          <>
            <Card variant="card">
              <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <RatePanel
                  label="Static baseline"
                  rate={rateA}
                  detected={statsS.detected}
                  total={statsS.totalTrials}
                  medianTtd={statsS.medianTtd}
                  color={SERIES.static}
                />
                <RatePanel
                  label="Agentic"
                  rate={rateB}
                  detected={statsA.detected}
                  total={statsA.totalTrials}
                  medianTtd={statsA.medianTtd}
                  color={SERIES.agentic}
                />
              </div>

              <div className="mt-1 border-t border-border pt-5">
                <p className="t-body text-ink">
                  <span className="font-medium">
                    {evasion?.significant ? 'Statistically significant' : 'Not statistically significant'}
                  </span>
                  {evasion && (
                    <>
                      {' · Fisher’s exact test · '}
                      <span className="t-technical">{formatP(evasion.p)}</span>
                      {' · α = '}
                      <span className="t-technical">{ALPHA}</span>
                    </>
                  )}
                </p>
                {verdict && <p className="t-body mt-1.5 text-ink-muted">{verdict}</p>}

                <div className="mt-4">
                  <Disclosure summary="View statistical details">
                    <DisclosureText>
                      Two different questions are tested here, and they answer different things.
                      <strong className="font-medium text-ink"> Evasion</strong> — whether a
                      technique went undetected — is a proportion, tested with Fisher's exact test
                      on detected versus missed counts. <strong className="font-medium text-ink">
                      Detection latency</strong> — how quickly the SIEM responded when it did — is
                      tested with Mann-Whitney U, which sees only the trials that were detected. A
                      technique that evaded completely contributes nothing to the latency test.
                    </DisclosureText>

                    <dl className="mt-4 space-y-2.5">
                      <DisclosureRow term="Evasion test">
                        Fisher's exact, two-sided. Table{' '}
                        <span className="t-technical">
                          [[{statsS.detected},{statsS.totalTrials - statsS.detected}], [
                          {statsA.detected},{statsA.totalTrials - statsA.detected}]]
                        </span>
                      </DisclosureRow>
                      <DisclosureRow term="Odds ratio">
                        {evasion ? formatOddsRatio(evasion.oddsRatio) : '—'} — the odds of detection
                        in the static group relative to agentic
                      </DisclosureRow>
                      <DisclosureRow term="p-value">
                        {evasion ? formatP(evasion.p) : '—'}
                      </DisclosureRow>

                      <DisclosureRow term="Latency test">
                        Mann-Whitney U on time-to-detect, detected trials only, two-tailed
                      </DisclosureRow>
                      <DisclosureRow term="U statistic">
                        {latency ? `${latency.u.toFixed(1)} (static sample)` : '—'} — U depends on
                        argument order; swapping the groups gives{' '}
                        {latency ? (latency.n1 * latency.n2 - latency.u).toFixed(1) : '—'}, but the
                        p-value is unchanged
                      </DisclosureRow>
                      <DisclosureRow term="Latency p-value">
                        {latency ? formatP(latency.p) : '—'}
                        {latency && ` · effect size ${effectMagnitude(latency.rankBiserial)} (${latency.rankBiserial.toFixed(2)})`}
                      </DisclosureRow>
                      <DisclosureRow term="Sample sizes">
                        Static {formatCount(statsS.totalTrials)} trials, agentic{' '}
                        {formatCount(statsA.totalTrials)}
                      </DisclosureRow>
                    </dl>

                    <div className="mt-4 space-y-2.5">
                      <DisclosureText>
                        <strong className="font-medium text-ink">Underpowered.</strong> The two
                        groups are small and unequal, so a non-significant result is the expected
                        outcome even if a real difference exists. Treat it as inconclusive rather
                        than as evidence of no effect.
                      </DisclosureText>
                      <DisclosureText>
                        <strong className="font-medium text-ink">Independence.</strong> Because the
                        Red Agent selects techniques based on prior trial outcomes, trials are not
                        fully independent draws, so this p-value should be read as indicative rather
                        than a strict significance test.
                      </DisclosureText>
                      <DisclosureText>
                        <strong className="font-medium text-ink">What latency does not measure.</strong>{' '}
                        A favourable latency result cannot be read as an evasion finding, and vice
                        versa. Neither should be cited without the other.
                      </DisclosureText>
                    </div>
                  </Disclosure>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-x-10 gap-y-8 xl:grid-cols-2">
              <Card title="Detection rate by technique" subtitle="Static against agentic, same techniques">
                <ChartFrame
                  height={260}
                  loading={loading}
                  isEmpty={perTechnique.length === 0}
                  emptyTitle="No trials in either mode yet"
                  legend={
                    <>
                      <LegendItem color={SERIES.static} label="Static baseline" />
                      <LegendItem color={SERIES.agentic} label="Agentic" />
                    </>
                  }
                >
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={perTechnique} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                        <CartesianGrid {...CHART_GRID} />
                        <XAxis dataKey="label" tick={CHART_AXIS.tick} tickLine={false} axisLine={CHART_AXIS.axisLine} interval={0} />
                        <YAxis
                          domain={[0, 1]}
                          tick={CHART_AXIS.tick}
                          tickLine={false}
                          axisLine={CHART_AXIS.axisLine}
                          tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
                          width={44}
                        />
                        <Tooltip
                          cursor={{ fill: 'var(--surface-2)' }}
                          contentStyle={CHART_TOOLTIP_STYLE}
                          labelFormatter={(_l, payload) =>
                            (payload?.[0]?.payload as (typeof perTechnique)[number] | undefined)?.full ?? ''
                          }
                          formatter={(value, name) =>
                            value == null ? ['no trials', String(name)] : [formatPct(Number(value)), String(name)]
                          }
                        />
                        <Bar dataKey="static" name="Static" fill={SERIES.static} maxBarSize={26} isAnimationActive={false} />
                        <Bar dataKey="agentic" name="Agentic" fill={SERIES.agentic} maxBarSize={26} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartFrame>
              </Card>

              <Card
                title="How quickly detection happens"
                subtitle="Detected trials only — further left means faster"
              >
                <ChartFrame
                  height={260}
                  loading={loading}
                  isEmpty={cdf.length === 0}
                  emptyTitle="No detected trials to plot"
                  legend={
                    <>
                      <LegendItem color={SERIES.static} label="Static baseline" />
                      <LegendItem color={SERIES.agentic} label="Agentic" />
                    </>
                  }
                >
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cdf} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                        <CartesianGrid {...CHART_GRID} />
                        <XAxis dataKey="label" tick={CHART_AXIS.tick} tickLine={false} axisLine={CHART_AXIS.axisLine} interval="preserveStartEnd" />
                        <YAxis
                          domain={[0, 1]}
                          tick={CHART_AXIS.tick}
                          tickLine={false}
                          axisLine={CHART_AXIS.axisLine}
                          tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
                          width={44}
                        />
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE}
                          formatter={(value) => (value == null ? '—' : formatPct(Number(value)))}
                        />
                        <Line type="stepAfter" dataKey="static" name="Static" stroke={SERIES.static} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                        <Line type="stepAfter" dataKey="agentic" name="Agentic" stroke={SERIES.agentic} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartFrame>
              </Card>
            </div>

            <Card
              title="Per-technique comparison"
              actions={
                <Link to="/trials" className="text-[13px] font-medium text-blue hover:text-brand-dark">
                  See the trials →
                </Link>
              }
            >
              <ul className="divide-y divide-border">
                {perTechnique.map((row) => {
                  const delta =
                    row.agentic !== null && row.static !== null ? row.agentic - row.static : null

                  return (
                    <li
                      key={row.key}
                      className="flex flex-wrap items-center gap-x-5 gap-y-1 py-2.5"
                    >
                      <span className="min-w-0 flex-1 truncate t-body text-ink">{row.full}</span>
                      <span className="t-technical w-24 text-right text-ink-muted">
                        {row.static === null ? '—' : formatPct(row.static)}
                        <span className="ml-1.5 text-ink-faint">n={row.nStatic}</span>
                      </span>
                      <span className="t-technical w-24 text-right text-ink">
                        {row.agentic === null ? '—' : formatPct(row.agentic)}
                        <span className="ml-1.5 text-ink-faint">n={row.nAgentic}</span>
                      </span>
                      <span className="w-20 text-right">
                        {delta === null ? (
                          <span className="t-secondary text-ink-faint">—</span>
                        ) : (
                          <span
                            className={`t-technical ${
                              Math.abs(delta) < 0.001
                                ? 'text-ink-muted'
                                : delta > 0
                                  ? 'text-blue'
                                  : 'text-red'
                            }`}
                          >
                            {delta > 0 ? '+' : ''}
                            {(delta * 100).toFixed(1)}
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="t-secondary mt-3 text-ink-faint">
                Columns: static detection rate, agentic detection rate, difference in percentage points.
                Positive means agentic detected more often.
              </p>
            </Card>

            <Card title="Detection latency summary">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <LatencyColumn heading="Static baseline" tone="static" q={qS} />
                <LatencyColumn heading="Agentic" tone="agentic" q={qA} />
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  )
}

function RatePanel({
  label,
  rate,
  detected,
  total,
  medianTtd,
  color,
}: {
  label: string
  rate: number | null
  detected: number
  total: number
  medianTtd: number | null
  color: string
}) {
  return (
    <div className="px-6 py-5">
      <p className="flex items-center gap-2 t-secondary text-ink-muted">
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} aria-hidden="true" />
        {label}
      </p>
      <p className="t-metric mt-2 text-ink">{rate === null ? '—' : formatPct(rate)}</p>
      <p className="t-secondary mt-1.5 text-ink">
        {detected} detected of {total} trials
      </p>
      <p className="t-secondary mt-0.5 text-ink-muted">
        Median detection {formatSeconds(medianTtd)}
      </p>
    </div>
  )
}

function LatencyColumn({
  heading,
  tone,
  q,
}: {
  heading: string
  tone: 'agentic' | 'static'
  q: ReturnType<typeof quantiles>
}) {
  return (
    <div>
      <p className="flex items-center gap-2 t-card text-ink">
        <span className="h-2 w-2 rounded-sm" style={{ background: SERIES[tone] }} aria-hidden="true" />
        {heading}
        <Badge tone="neutral">{q.n} detected</Badge>
      </p>
      {q.n === 0 ? (
        <p className="t-secondary mt-2 text-ink-muted">No detected trials.</p>
      ) : (
        <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3">
          <Stat label="Fastest" value={formatSeconds(q.min)} />
          <Stat label="Lower quartile" value={formatSeconds(q.q1)} />
          <Stat label="Median" value={formatSeconds(q.median)} />
          <Stat label="Upper quartile" value={formatSeconds(q.q3)} />
          <Stat label="Slowest" value={formatSeconds(q.max)} />
        </dl>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="t-secondary text-ink-muted">{label}</dt>
      <dd className="t-technical mt-0.5 text-ink">{value}</dd>
    </div>
  )
}
