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
import { Card } from '../components/ui/Card'
import { Kpi, KpiRow } from '../components/ui/Kpi'
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
  ChartFrame,
  LegendItem,
} from '../components/ui/ChartFrame'
import { EmptyState, ErrorState } from '../components/ui/EmptyState'
import { ToggleGroup } from '../components/ui/Field'
import { SkeletonRows } from '../components/ui/Skeleton'
import { useTrialsData } from '../hooks/useTrialsData'
import { formatCount, formatPct, formatSeconds, ratioToPercent } from '../lib/format'
import { describeEps, overviewInsights } from '../lib/insights'
import { computeEps } from '../lib/metrics/eps'
import { aggregateTrials, rollupByTechnique } from '../lib/metrics/tpr'
import { missStreak } from '../lib/metrics/streaks'
import { TREND_RULE_TEXT, trendBuckets } from '../lib/metrics/trend'
import { compareTechniques, describeTechnique } from '../lib/techniques'
import type { Mode } from '../lib/api/types'

const SERIES = { agentic: 'var(--red)', static: 'var(--gray)' } as const

/** Below this detection rate a technique is called out as needing attention. A stated
 *  threshold, not a score — the same number is shown on the row itself. */
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

      <div className="space-y-8 px-6 pb-12 lg:px-8">
        {error ? (
          <Card variant="card" title="Could not load results">
            <ErrorState message={error} onRetry={refetch} className="py-8" />
          </Card>
        ) : (
          <>
            {/* The answer, before any chart. */}
            <Card variant="card" className="overflow-hidden">
              <KpiRow>
                <Kpi
                  label="Detection rate"
                  value={loading ? '—' : formatPct(stats.tpr)}
                  tone={
                    stats.tpr === null ? 'neutral' : stats.tpr >= 0.7 ? 'positive' : stats.tpr >= 0.5 ? 'neutral' : 'attention'
                  }
                  interpretation={
                    loading
                      ? undefined
                      : stats.tpr !== null && stats.tpr >= 0.7
                        ? 'Most techniques are being caught'
                        : 'A meaningful share of trials goes undetected'
                  }
                  evidence={loading ? undefined : `${stats.detected} of ${stats.totalTrials} trials detected`}
                />
                <Kpi
                  label="Median detection time"
                  value={loading ? '—' : formatSeconds(stats.medianTtd)}
                  interpretation="How quickly Wazuh alerts, when it does"
                  evidence={loading ? undefined : `Across ${stats.detected} detected trials`}
                />
                <Kpi
                  label="Silent misses"
                  value={loading ? '—' : formatCount(streak.current)}
                  tone={streak.alerting ? 'risk' : 'neutral'}
                  interpretation={
                    streak.alerting
                      ? 'Pipeline may have stopped — investigate before trusting new results'
                      : 'No current run of undetected, alert-free trials'
                  }
                  evidence={loading ? undefined : `Warns at ${streak.threshold} in a row`}
                />
                <Kpi
                  label="Techniques needing attention"
                  value={loading ? '—' : formatCount(needingAttention.length)}
                  tone={needingAttention.length > 0 ? 'attention' : 'positive'}
                  interpretation={
                    needingAttention.length > 0
                      ? `Detected in under ${formatPct(ATTENTION_TPR, 0)} of trials`
                      : 'All techniques above the attention threshold'
                  }
                  evidence={
                    loading || needingAttention.length === 0
                      ? undefined
                      : needingAttention.map((row) => row.label).join(', ')
                  }
                />
              </KpiRow>
            </Card>

            {insights.length > 0 && (
              <Card title="Key findings">
                <InsightList insights={insights} />
              </Card>
            )}

            <div className="grid grid-cols-1 gap-x-10 gap-y-8 xl:grid-cols-2">
              <Card
                title="Detection by technique"
                subtitle={
                  worst
                    ? `Worst coverage: ${worst.short} at ${formatPct(worst.rate / 100, 0)}`
                    : undefined
                }
              >
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

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Link to="/gaps" className="text-[13px] font-medium text-blue hover:text-brand-dark">
                    Where detection is weakest →
                  </Link>
                  <span className="t-secondary text-ink-faint">
                    {needingAttention.length} of {byTechnique.length} below threshold
                  </span>
                </div>
              </Card>

              <Card
                title="Detection over time"
                subtitle={TREND_RULE_TEXT[trend.rule]}
              >
                <ChartFrame
                  height={260}
                  loading={loading}
                  isEmpty={trend.points.length < 2}
                  emptyTitle="Not enough history yet"
                  emptyDetail="A trend needs trials from at least two runs or days."
                  legend={<LegendItem color={SERIES[mode]} label="Detection rate" />}
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

                {epsReading && (
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="t-body text-ink">{epsReading.headline}</span>
                    <span className="t-secondary text-ink-muted">
                      {epsReading.strength} · compares the early and late halves of the campaign
                    </span>
                  </div>
                )}
              </Card>
            </div>

            <Card
              title="Recent trials"
              actions={
                <Link to="/trials" className="text-[13px] font-medium text-blue hover:text-brand-dark">
                  All trials →
                </Link>
              }
            >
              {loading ? (
                <SkeletonRows rows={5} columns={3} />
              ) : recent.length === 0 ? (
                <EmptyState
                  title="No trials yet"
                  detail="Start a batch from Live to record results."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {recent.map((trial, index) => {
                    const meta = describeTechnique(trial.technique)
                    return (
                      <li
                        key={`${trial.start_time}-${index}`}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5"
                      >
                        <span className="min-w-0 flex-1 truncate t-body text-ink">
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
                          {trial.start_time.slice(0, 10)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  )
}
