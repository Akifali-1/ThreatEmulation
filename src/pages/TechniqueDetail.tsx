import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
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
import { EpsBreakdown, EpsMeter } from '../components/domain/EpsMeter'
import { ResultBadge } from '../components/domain/ResultBadge'
import { TrialDetail } from '../components/domain/TrialDetail'
import { Card } from '../components/ui/Card'
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
  ChartFrame,
  LegendItem,
} from '../components/ui/ChartFrame'
import { Drawer } from '../components/ui/Drawer'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { ToggleGroup } from '../components/ui/Field'
import { Stat, StatRow } from '../components/ui/Stat'
import { useTrialsData } from '../hooks/useTrialsData'
import { formatCount, formatDateTime, formatDelay, formatPct, formatSeconds } from '../lib/format'
import { computeEps, epsHalves } from '../lib/metrics/eps'
import { median, ttDs } from '../lib/metrics/tpr'
import { runningTrend } from '../lib/metrics/trend'
import { describeTechnique } from '../lib/techniques'
import type { Mode, Trial } from '../lib/api/types'

export default function TechniqueDetail() {
  const { technique: rawParam } = useParams<{ technique: string }>()
  const technique = rawParam ? decodeURIComponent(rawParam) : ''

  const [mode, setMode] = useState<Mode>('agentic')
  const { trials, loading, error, refetch } = useTrialsData(mode)
  const [selected, setSelected] = useState<Trial | null>(null)

  const mine = useMemo(
    () => trials.filter((trial) => trial.technique === technique),
    [trials, technique],
  )

  const meta = describeTechnique(technique)
  const eps = useMemo(() => computeEps(mine), [mine])
  const halves = useMemo(() => epsHalves(mine), [mine])

  const stats = useMemo(() => {
    const detected = mine.filter((t) => t.detected).length
    return {
      n: mine.length,
      detected,
      tpr: mine.length > 0 ? detected / mine.length : null,
      medianTtd: median(ttDs(mine)),
    }
  }, [mine])

  const sequence = useMemo(
    () =>
      runningTrend(mine).map((point) => ({
        label: `#${point.index}`,
        tpr: point.runningTpr * 100,
        delay: point.delay,
      })),
    [mine],
  )

  /**
   * Trials grouped by injected delay, split by outcome.
   *
   * A scatter of delay-vs-outcome was the obvious first idea, but the agent reuses the same
   * delay values heavily (29 of 30 Discovery trials ran at 5s), so every point would land on
   * the same two coordinates and the misses would be invisible. Counting per delay instead
   * keeps the ties visible and answers the question directly: at which delay do misses appear?
   */
  const delayBuckets = useMemo(() => {
    const buckets = new Map<number, { delay: number; detected: number; missed: number }>()

    for (const trial of mine) {
      if (typeof trial.delay_used !== 'number') continue
      let bucket = buckets.get(trial.delay_used)
      if (!bucket) {
        bucket = { delay: trial.delay_used, detected: 0, missed: 0 }
        buckets.set(trial.delay_used, bucket)
      }
      if (trial.detected) bucket.detected += 1
      else bucket.missed += 1
    }

    return [...buckets.values()].sort((a, b) => a.delay - b.delay)
  }, [mine])

  const recent = useMemo(
    () =>
      [...mine]
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .slice(0, 12),
    [mine],
  )

  return (
    <>
      <PageHeader
        title={meta.mapped ? meta.name : technique}
        description={meta.mapped ? meta.summary : 'No ATT&CK mapping is defined for this ability yet.'}
        actions={
          <>
            <Link
              to="/techniques"
              className="rounded border border-border-strong bg-surface px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-2"
            >
              ← All techniques
            </Link>
            <ToggleGroup<Mode>
              ariaLabel="Trial mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'agentic', label: 'Agentic', activeClassName: 'text-red' },
                { value: 'static', label: 'Static', activeClassName: 'text-ink' },
              ]}
            />
          </>
        }
      />

      <div className="space-y-4 p-5 lg:p-6">
        {error ? (
          <Card title="Could not load trials">
            <EmptyState title="Backend unreachable" detail={error} action={<Button size="sm" onClick={refetch}>Retry</Button>} />
          </Card>
        ) : !loading && mine.length === 0 ? (
          <Card>
            <EmptyState
              title={`No ${mode} trials for this technique`}
              detail="It may only have been run in the other mode. Switch the mode selector, or run a batch for it."
            />
          </Card>
        ) : (
          <>
            <Card flush className="overflow-hidden">
              <StatRow>
                <Stat label="TPR" value={loading ? '—' : stats.tpr === null ? '—' : formatPct(stats.tpr)} tone={stats.tpr !== null && stats.tpr >= 0.5 ? 'detected' : 'miss'} />
                <Stat label="Median MTTD" value={loading ? '—' : formatSeconds(stats.medianTtd)} sub="Detected trials only" />
                <Stat label="Detected" value={loading ? '—' : `${formatCount(stats.detected)} / ${formatCount(stats.n)}`} />
                <Stat label="EPS" value={loading ? '—' : <EpsMeter eps={eps} />} sub="Early vs late halves" />
              </StatRow>
            </Card>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
              <Card title="Detection rate over the campaign" subtitle="Running TPR, oldest trial to newest">
                <ChartFrame
                  height={240}
                  loading={loading}
                  isEmpty={sequence.length < 2}
                  emptyTitle="Not enough trials to plot a sequence"
                  legend={<LegendItem color="var(--blue)" label="Running detection rate" />}
                >
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sequence} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                        <CartesianGrid {...CHART_GRID} />
                        <XAxis dataKey="label" tick={CHART_AXIS.tick} tickLine={false} axisLine={CHART_AXIS.axisLine} interval="preserveStartEnd" />
                        <YAxis domain={[0, 100]} tick={CHART_AXIS.tick} tickLine={false} axisLine={CHART_AXIS.axisLine} tickFormatter={(v: number) => `${v}%`} width={44} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Running TPR']} />
                        <Line type="monotone" dataKey="tpr" stroke="var(--blue)" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartFrame>
              </Card>

              <Card
                title="Injected delay vs outcome"
                subtitle="Agentic trials only — where the agent pushed the delay"
              >
                <ChartFrame
                  height={240}
                  loading={loading}
                  isEmpty={delayBuckets.length === 0}
                  emptyTitle="No delay data for this technique"
                  emptyDetail="Either the trials predate temporal adaptation, or this technique has only run in static mode."
                  legend={
                    <>
                      <LegendItem color="var(--teal)" label="Detected" />
                      <LegendItem color="var(--gray)" label="Not detected" />
                      <span className="text-[11px] text-ink-faint">
                        Stacked height = trials run at that delay
                      </span>
                    </>
                  }
                >
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={delayBuckets}
                        margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                      >
                        <CartesianGrid {...CHART_GRID} />
                        <XAxis
                          dataKey="delay"
                          tick={CHART_AXIS.tick}
                          tickLine={false}
                          axisLine={CHART_AXIS.axisLine}
                          tickFormatter={(value: number) => `${value}s`}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={CHART_AXIS.tick}
                          tickLine={false}
                          axisLine={CHART_AXIS.axisLine}
                          width={32}
                        />
                        <Tooltip
                          cursor={{ fill: 'var(--surface-2)' }}
                          contentStyle={CHART_TOOLTIP_STYLE}
                          labelFormatter={(label) => `Injected delay: ${label}s`}
                          formatter={(value, name) => [`${value} trials`, String(name)]}
                        />
                        <Bar
                          dataKey="detected"
                          name="Detected"
                          stackId="outcome"
                          fill="var(--teal)"
                          maxBarSize={56}
                          isAnimationActive={false}
                        />
                        <Bar
                          dataKey="missed"
                          name="Not detected"
                          stackId="outcome"
                          fill="var(--gray)"
                          maxBarSize={56}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartFrame>
              </Card>
            </div>

            <Card title="Evasion persistence breakdown" subtitle="The two halves the EPS score compares">
              <EpsBreakdown halves={halves} />
              <p className="mt-3 max-w-3xl text-[11.5px] leading-relaxed text-ink-faint">
                Trials are sorted chronologically, split at the midpoint (floor(N/2)), and the
                detection rate of each half compared.{' '}
                {mode === 'static' &&
                  'The static baseline runs a fixed schedule, so a non-zero EPS here reflects variance rather than adaptation. '}
                Positive EPS means the later half was detected less often.
              </p>
            </Card>

            <Card title="Recent trials" subtitle="Select a row to read the reasoning" flush>
              {loading ? (
                <div className="p-4">
                  <EmptyState title="Loading…" />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {recent.map((trial, i) => (
                    <li key={`${trial.start_time}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setSelected(trial)}
                        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-left hover:bg-surface-2"
                      >
                        <span className="tnum shrink-0 font-mono text-[11px] text-ink-muted">
                          {formatDateTime(trial.start_time)}
                        </span>
                        <ResultBadge detected={trial.detected} />
                        <span className="tnum font-mono text-[11px] text-ink-muted">
                          delay {formatDelay(trial.delay_used)}
                        </span>
                        <span className="tnum font-mono text-[11px] text-ink-muted">
                          TTD {formatSeconds(trial.time_to_detect)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={meta.mapped ? meta.name : technique}
        subtitle={selected ? formatDateTime(selected.start_time) : undefined}
      >
        {selected && <TrialDetail trial={selected} mode={mode} />}
      </Drawer>
    </>
  )
}
