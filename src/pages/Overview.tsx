import { useMemo, useState } from 'react'
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
import { InsightList } from '../components/ui/Insight'
import { CardHeading, KpiCard, KpiGrid } from '../components/ui/Kpi'
import { Icon } from '../components/ui/Icon'
import { EmptyState, ErrorState } from '../components/ui/EmptyState'
import { ToggleGroup } from '../components/ui/Field'
import { SkeletonRows } from '../components/ui/Skeleton'
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
  ChartFrame,
  LegendItem,
} from '../components/ui/ChartFrame'
import { useTrialsData } from '../hooks/useTrialsData'
import { formatCount, formatDay, formatPct, formatSeconds, ratioToPercent } from '../lib/format'
import { describeEps, overviewInsights } from '../lib/insights'
import { computeEps } from '../lib/metrics/eps'
import { aggregateTrials, rollupByTechnique, ttDs } from '../lib/metrics/tpr'
import { quantiles } from '../lib/metrics/distribution'
import { missStreak } from '../lib/metrics/streaks'
import { TREND_RULE_TEXT, trendBuckets } from '../lib/metrics/trend'
import { compareTechniques, describeTechnique } from '../lib/techniques'
import type { Mode } from '../lib/api/types'

const SERIES = { agentic: 'var(--series-agentic)', static: 'var(--series-static)' } as const

/** Below this detection rate a technique is called out. A stated threshold, shown on the card. */
const ATTENTION_TPR = 0.7

export default function Overview() {
  const [mode, setMode] = useState<Mode>('agentic')
  const { trials, loading, error, refetch } = useTrialsData(mode)

  const stats = useMemo(() => aggregateTrials(trials), [trials])
  const insights = useMemo(() => overviewInsights({ trials }), [trials])
  const streak = useMemo(() => missStreak(trials), [trials])

  const byTechnique = useMemo(
    () =>
      rollupByTechnique(trials)
        .map((rollup) => {
          const meta = describeTechnique(rollup.technique)
          return {
            key: rollup.technique,
            label: meta.mitreId || rollup.technique,
            full: meta.mapped ? `${meta.mitreId} ${meta.name}` : rollup.technique,
            short: meta.mapped ? meta.name : rollup.technique,
            rate: ratioToPercent(rollup.tpr) ?? 0,
            n: rollup.n,
          }
        })
        .sort((a, b) => compareTechniques(a.key, b.key)),
    [trials],
  )

  const needingAttention = useMemo(
    () => byTechnique.filter((row) => row.rate < ATTENTION_TPR * 100),
    [byTechnique],
  )

  const trend = useMemo(() => {
    const { buckets, rule } = trendBuckets(trials)
    return {
      rule,
      points: buckets.map((bucket) => ({ ...bucket, rate: ratioToPercent(bucket.tpr) })),
    }
  }, [trials])

  const worst = useMemo(
    () => [...byTechnique].sort((a, b) => a.rate - b.rate)[0],
    [byTechnique],
  )

  const recent = useMemo(
    () =>
      [...trials]
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .slice(0, 5),
    [trials],
  )

  const overallEps = useMemo(() => computeEps(trials), [trials])
  const epsReading = describeEps(overallEps)
  const ttd = useMemo(() => quantiles(ttDs(trials)), [trials])

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          loading
            ? 'Loading the latest results…'
            : `${formatCount(stats.totalTrials)} ${mode} trials across ${formatCount(byTechnique.length)} techniques.`
        }
        actions={
          <ToggleGroup<Mode>
            ariaLabel="Trial mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'agentic', label: 'Agentic', activeClassName: 'text-red' },
              { value: 'static', label: 'Static' },
            ]}
          />
        }
      />

      <div className="space-y-6 px-6 pb-12 lg:px-8">
        {error ? (
          <div className="rounded-lg border border-border bg-surface">
            <ErrorState message={error} onRetry={refetch} className="py-8" />
          </div>
        ) : (
          <>
            <KpiGrid>
              <KpiCard
                tone={stats.tpr === null ? 'gray' : stats.tpr >= 0.7 ? 'teal' : 'amber'}
                label="Detection rate"
                value={loading ? '—' : formatPct(stats.tpr)}
                description={
                  loading
                    ? 'Loading…'
                    : stats.tpr !== null && stats.tpr >= 0.7
                      ? 'Most techniques are being caught'
                      : 'A meaningful share of trials goes undetected'
                }
                meter={loading || stats.tpr === null ? null : stats.tpr}
                meterCaption="Share of all trials with at least one alert"
                footer={loading ? undefined : `${stats.detected} of ${stats.totalTrials} trials detected`}
              />

              <KpiCard
                tone="blue"
                label="Median detection time"
                value={loading ? '—' : formatSeconds(stats.medianTtd)}
                description="How quickly Wazuh alerts, when it does"
                /*
                 * No meter here. The obvious one — median as a position within the observed
                 * range — collapses to a near-empty bar whenever a single slow outlier exists
                 * (430s against a 16.6s median), which reads as a rendering bug rather than a
                 * fact. The interquartile spread says more and can't be misread.
                 */
                footer={
                  loading
                    ? undefined
                    : ttd.q1 !== null && ttd.q3 !== null
                      ? `Half of detections between ${formatSeconds(ttd.q1)} and ${formatSeconds(ttd.q3)}`
                      : `Across ${stats.detected} detected trials`
                }
              />

              <KpiCard
                tone={streak.alerting ? 'red' : 'gray'}
                label="Silent misses"
                value={loading ? '—' : formatCount(streak.current)}
                description={
                  streak.alerting
                    ? 'Pipeline may have stopped — investigate before trusting new results'
                    : 'No current run of undetected, alert-free trials'
                }
                footer={loading ? undefined : `Warns at ${streak.threshold} in a row`}
              />

              <KpiCard
                tone={needingAttention.length > 0 ? 'amber' : 'teal'}
                label="Techniques needing attention"
                value={loading ? '—' : formatCount(needingAttention.length)}
                description={
                  needingAttention.length > 0
                    ? `Detected in under ${formatPct(ATTENTION_TPR, 0)} of trials`
                    : 'All techniques above the attention threshold'
                }
                chips={loading ? undefined : needingAttention.map((row) => row.label)}
              />
            </KpiGrid>

            {insights.length > 0 && (
              <section className="rounded-lg border border-border bg-surface">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <CardHeading
                    title="Key findings"
                    subtitle="What the current data is telling you"
                  />
                  <Link
                    to="/gaps"
                    className="t-secondary flex items-center gap-1.5 rounded border border-border-strong bg-surface px-3 py-1.5 font-medium text-ink transition-colors hover:bg-surface-2"
                  >
                    View detailed analysis
                    <Icon name="chevronRight" size={13} />
                  </Link>
                </header>
                <div className="px-5">
                  <InsightList insights={insights} />
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="flex flex-col rounded-lg border border-border bg-surface">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <CardHeading
                    title="Detection by technique"
                    subtitle={
                      worst
                        ? `Worst coverage: ${worst.short} at ${formatPct(worst.rate / 100, 0)}`
                        : undefined
                    }
                  />
                  <Link
                    to="/techniques"
                    className="t-secondary flex items-center gap-1.5 font-medium text-blue hover:text-brand-dark"
                  >
                    View all
                    <Icon name="chevronRight" size={13} />
                  </Link>
                </header>

                <div className="px-5 py-4">
                  <ChartFrame
                    height={260}
                    loading={loading}
                    isEmpty={byTechnique.length === 0}
                    emptyTitle="No trials recorded yet"
                    emptyDetail="Start a batch to populate this chart."
                    legend={<LegendItem color={SERIES[mode]} label="Detection rate" />}
                  >
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byTechnique} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                          <CartesianGrid {...CHART_GRID} />
                          <XAxis
                            dataKey="label"
                            tick={CHART_AXIS.tick}
                            tickLine={false}
                            axisLine={CHART_AXIS.axisLine}
                            interval={0}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={CHART_AXIS.tick}
                            tickLine={false}
                            axisLine={CHART_AXIS.axisLine}
                            tickFormatter={(value: number) => `${value}%`}
                            width={44}
                          />
                          <Tooltip
                            cursor={{ fill: 'var(--surface-2)' }}
                            contentStyle={CHART_TOOLTIP_STYLE}
                            labelFormatter={(_label, payload) =>
                              (payload?.[0]?.payload as (typeof byTechnique)[number] | undefined)?.full ?? ''
                            }
                            formatter={(value, _name, item) => {
                              const row = item?.payload as (typeof byTechnique)[number] | undefined
                              return [`${Number(value).toFixed(1)}%  (${row?.n ?? 0} trials)`, 'Detected']
                            }}
                          />
                          <Bar dataKey="rate" fill={SERIES[mode]} maxBarSize={56} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartFrame>
                </div>
              </section>

              <section className="flex flex-col rounded-lg border border-border bg-surface">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <CardHeading
                    title="Detection over time"
                    subtitle={TREND_RULE_TEXT[trend.rule]}
                  />
                  <Link
                    to="/trials"
                    className="t-secondary flex items-center gap-1.5 font-medium text-blue hover:text-brand-dark"
                  >
                    View all
                    <Icon name="chevronRight" size={13} />
                  </Link>
                </header>

                <div className="px-5 py-4">
                  <ChartFrame
                    height={260}
                    loading={loading}
                    isEmpty={trend.points.length < 2}
                    emptyTitle="Not enough history yet"
                    emptyDetail="A trend needs trials from at least two runs or days."
                    legend={
                      <>
                        <LegendItem color={SERIES[mode]} label="Detection rate" />
                        {epsReading && (
                          <span className="t-secondary text-ink-faint">
                            {epsReading.headline} · {epsReading.strength}
                          </span>
                        )}
                      </>
                    }
                  >
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend.points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                          <CartesianGrid {...CHART_GRID} />
                          <XAxis
                            dataKey="label"
                            tick={CHART_AXIS.tick}
                            tickLine={false}
                            axisLine={CHART_AXIS.axisLine}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={CHART_AXIS.tick}
                            tickLine={false}
                            axisLine={CHART_AXIS.axisLine}
                            tickFormatter={(value: number) => `${value}%`}
                            width={44}
                          />
                          <Tooltip
                            contentStyle={CHART_TOOLTIP_STYLE}
                            labelFormatter={(_label, payload) =>
                              (payload?.[0]?.payload as (typeof trend.points)[number] | undefined)?.full ?? ''
                            }
                            formatter={(value, _n, item) => {
                              const row = item?.payload as (typeof trend.points)[number] | undefined
                              return [`${Number(value).toFixed(1)}%  (${row?.trials ?? 0} trials)`, 'Detected']
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="rate"
                            stroke={SERIES[mode]}
                            strokeWidth={2}
                            dot={{ r: 3, strokeWidth: 0, fill: SERIES[mode] }}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartFrame>
                </div>
              </section>
            </div>

            <section className="rounded-lg border border-border bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <CardHeading title="Recent trials" />
                <Link
                  to="/trials"
                  className="t-secondary flex items-center gap-1.5 font-medium text-blue hover:text-brand-dark"
                >
                  View all
                  <Icon name="chevronRight" size={13} />
                </Link>
              </header>

              {loading ? (
                <div className="p-5">
                  <SkeletonRows rows={5} columns={3} />
                </div>
              ) : recent.length === 0 ? (
                <EmptyState title="No trials yet" detail="Start a batch from Live to record results." />
              ) : (
                <ul className="divide-y divide-border px-5">
                  {recent.map((trial, index) => {
                    const meta = describeTechnique(trial.technique)
                    return (
                      <li
                        key={`${trial.start_time}-${index}`}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5"
                      >
                        <span className="t-body min-w-0 flex-1 truncate text-ink">
                          {meta.mapped ? meta.name : trial.technique}
                        </span>
                        <span
                          className={`t-secondary font-medium ${
                            trial.detected ? 'text-teal' : 'text-miss'
                          }`}
                        >
                          {trial.detected ? 'Detected' : 'Not detected'}
                        </span>
                        <span className="t-technical w-16 text-right text-ink-muted">
                          {trial.detected ? formatSeconds(trial.time_to_detect) : '—'}
                        </span>
                        <span className="t-secondary w-24 text-right text-ink-faint">
                          {formatDay(trial.start_time)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
