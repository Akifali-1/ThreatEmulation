import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { PageHeader } from '../components/layout/PageHeader'
import { NumberedInsightList } from '../components/ui/Insight'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { CardHeading } from '../components/ui/Kpi'
import { Disclosure, DisclosureText } from '../components/ui/Disclosure'
import { EmptyState } from '../components/ui/EmptyState'
import { ToggleGroup } from '../components/ui/Field'
import { Table, type Column, type SortState } from '../components/ui/Table'
import { useBlueProposals } from '../hooks/useBlueProposals'
import { useTrialsData } from '../hooks/useTrialsData'
import { formatCount, formatPct } from '../lib/format'
import { computeEps } from '../lib/metrics/eps'
import { rollupByTechnique } from '../lib/metrics/tpr'
import { describeEps, type Insight } from '../lib/insights'
import { describeTechnique } from '../lib/techniques'
import type { Mode } from '../lib/api/types'

interface GapRow {
  key: string
  name: string
  mitreId: string
  n: number
  tpr: number | null
  trendHeadline: string
  trendStrength: string
  proposalStatus: string | null
}

/**
 * Where detection is weakest.
 *
 * Ranked weakest-first. Everything here is derived from the trial list and the proposal queue —
 * no new metric, and the ordering is a sort rather than a judgement.
 */
export default function DetectionGaps() {
  const [mode, setMode] = useState<Mode>('agentic')
  const [sort, setSort] = useState<SortState>({ key: 'tpr', dir: 'asc' })
  const { trials, loading, error, refetch } = useTrialsData(mode)
  const proposals = useBlueProposals()
  const navigate = useNavigate()

  const proposalByTechnique = useMemo(() => {
    const map = new Map<string, string>()
    for (const proposal of proposals.proposals) map.set(proposal.technique, proposal.status)
    return map
  }, [proposals.proposals])

  const rows = useMemo<GapRow[]>(
    () =>
      rollupByTechnique(trials).map((rollup) => {
        const meta = describeTechnique(rollup.technique)
        const reading = describeEps(computeEps(rollup.trials))
        return {
          key: rollup.technique,
          name: meta.mapped ? meta.name : rollup.technique,
          mitreId: meta.mapped ? meta.mitreId : 'unmapped',
          n: rollup.n,
          tpr: rollup.tpr,
          trendHeadline: reading ? reading.headline : 'Not enough trials to read a trend',
          trendStrength: reading ? reading.strength : `${rollup.n} recorded`,
          proposalStatus: proposalByTechnique.get(rollup.technique) ?? null,
        }
      }),
    [trials, proposalByTechnique],
  )

  const sorted = useMemo(() => {
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * factor
      if (sort.key === 'n') return (a.n - b.n) * factor
      // Nulls always sort last regardless of direction.
      if (a.tpr === null) return 1
      if (b.tpr === null) return -1
      return (a.tpr - b.tpr) * factor
    })
  }, [rows, sort])

  const headline = useMemo<Insight[]>(() => {
    if (sorted.length === 0) return []
    const insights: Insight[] = []

    const weakest = [...sorted].filter((r) => r.tpr !== null)[0]
    if (weakest?.tpr != null) {
      insights.push({
        id: 'weakest',
        tone: weakest.tpr < 0.5 ? 'risk' : weakest.tpr < 0.7 ? 'attention' : 'neutral',
        title: `${weakest.name} is detected least often`,
        detail: `${formatPct(weakest.tpr)} detection across ${weakest.n} trials`,
      })
    }

    const declining = rows.filter((r) => r.trendHeadline === 'Detection declined over time' && r.n >= 4)
    if (declining.length > 0) {
      insights.push({
        id: 'declining',
        tone: 'attention',
        title: `${declining.length} technique${declining.length === 1 ? '' : 's'} declining over time`,
        detail: declining.map((r) => r.name).join(', '),
      })
    }

    return insights
  }, [sorted, rows])

  const columns: Column<GapRow>[] = [
    {
      key: 'name',
      header: 'Technique',
      sortValue: (row) => row.name,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="t-body font-medium text-ink">{row.name}</span>
          <span className="t-technical mt-0.5 text-ink-faint">{row.mitreId}</span>
        </span>
      ),
    },
    {
      key: 'tpr',
      header: 'Detection rate',
      width: 'w-[168px]',
      sortValue: (row) => row.tpr ?? Number.POSITIVE_INFINITY,
      cell: (row) => {
        const rate = row.tpr
        const tone =
          rate === null ? 'text-ink-muted' : rate < 0.5 ? 'text-red' : rate < 0.7 ? 'text-amber' : 'text-ink'
        return (
          <span className="flex flex-col">
            <span className={`t-metric text-[24px] ${tone}`}>
              {rate === null ? '—' : formatPct(rate, 0)}
            </span>
            <span className="t-secondary text-ink-muted">
              detection · {formatCount(row.n)} trials
            </span>
          </span>
        )
      },
    },
    {
      key: 'trend',
      header: 'Trend',
      width: 'w-[240px]',
      cell: (row) => (
        <span className="flex flex-col">
          <span className="t-secondary text-ink">{row.trendHeadline}</span>
          <span className="t-secondary mt-0.5 text-ink-muted">{row.trendStrength}</span>
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: 'w-[136px]',
      cell: (row) =>
        row.proposalStatus ? (
          <Badge tone={row.proposalStatus === 'pending_approval' ? 'pending' : 'neutral'}>
            {row.proposalStatus === 'pending_approval'
              ? 'Rule proposed'
              : row.proposalStatus === 'approved'
                ? 'Rule approved'
                : 'Rule rejected'}
          </Badge>
        ) : (
          <Badge tone="neutral">No proposal</Badge>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Detection Gaps"
        description="Techniques ranked by how often they evade detection, weakest first."
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
            <EmptyState
              title="Backend unreachable"
              detail={error}
              action={
                <Button size="sm" onClick={refetch}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {headline.length > 0 && (
              <section className="rounded-lg border border-border bg-surface-2 p-5">
                <CardHeading title="What stands out" />
                <div className="mt-4">
                  <NumberedInsightList insights={headline} />
                </div>
              </section>
            )}

            <section className="rounded-lg border border-border bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <CardHeading
                  title="All techniques"
                  subtitle={`${formatCount(sorted.length)} techniques · ${formatCount(trials.length)} trials in this mode`}
                />
              </header>

              <Table<GapRow>
                columns={columns}
                rows={sorted}
                rowKey={(row) => row.key}
                sort={sort}
                onSortChange={setSort}
                onRowClick={(row) => navigate(`/techniques/${encodeURIComponent(row.key)}`)}
                loading={loading}
                skeletonRows={6}
                empty={
                  <EmptyState
                    title="No trials recorded for this mode"
                    detail="Run a batch to establish detection coverage."
                  />
                }
                className="px-2"
              />
            </section>

            <Disclosure summary="How this ranking is calculated">
              <DisclosureText>
                Techniques are sorted by detection rate, lowest first. Detection rate is the share
                of that technique's trials in which Wazuh raised at least one alert. Trials are
                never excluded — a technique with three trials is ranked alongside one with thirty,
                so the trial count is shown on every row.
              </DisclosureText>
              <DisclosureText>
                The trend column uses the same chronological early-versus-late comparison as
                everywhere else in this dashboard. A technique can have a high overall detection
                rate and still be declining, which is why both are shown. With fewer than four
                trials the comparison is not meaningful and reads as such.
              </DisclosureText>
            </Disclosure>
          </>
        )}
      </div>
    </>
  )
}
