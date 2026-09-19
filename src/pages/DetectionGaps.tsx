import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '../components/layout/PageHeader'
import { InsightList } from '../components/ui/Insight'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Disclosure, DisclosureText } from '../components/ui/Disclosure'
import { EmptyState } from '../components/ui/EmptyState'
import { ToggleGroup } from '../components/ui/Field'
import { SkeletonRows } from '../components/ui/Skeleton'
import { useBlueProposals } from '../hooks/useBlueProposals'
import { useTrialsData } from '../hooks/useTrialsData'
import { formatCount, formatPct } from '../lib/format'
import { computeEps } from '../lib/metrics/eps'
import { rollupByTechnique } from '../lib/metrics/tpr'
import { describeEps, type Insight } from '../lib/insights'
import { describeTechnique } from '../lib/techniques'
import type { Mode } from '../lib/api/types'

/**
 * Where detection is weakest.
 *
 * Ranked by detection rate, weakest first. Everything on this page is derived from the trial
 * list and the proposal queue — no new metric, no score invented for the purpose. The ranking
 * is a sort, not a judgement.
 */
export default function DetectionGaps() {
  const [mode, setMode] = useState<Mode>('agentic')
  const { trials, loading, error, refetch } = useTrialsData(mode)
  const proposals = useBlueProposals()

  const rows = useMemo(() => {
    return rollupByTechnique(trials)
      .map((rollup) => {
        const eps = computeEps(rollup.trials)
        return {
          technique: rollup.technique,
          meta: describeTechnique(rollup.technique),
          n: rollup.n,
          detected: rollup.detected,
          tpr: rollup.tpr,
          medianTtd: rollup.medianTtd,
          eps,
          reading: describeEps(eps),
        }
      })
      .sort((a, b) => (a.tpr ?? 1) - (b.tpr ?? 1))
  }, [trials])

  const headline = useMemo<Insight[]>(() => {
    if (rows.length === 0) return []

    const weakest = rows[0]
    const insights: Insight[] = []

    if (weakest.tpr !== null) {
      insights.push({
        id: 'weakest',
        tone: weakest.tpr < 0.5 ? 'risk' : weakest.tpr < 0.7 ? 'attention' : 'neutral',
        title: `${weakest.meta.mapped ? weakest.meta.name : weakest.technique} is detected least often`,
        detail: `${formatPct(weakest.tpr)} detection across ${weakest.n} trials`,
      })
    }

    const uncovered = rows.filter(
      (row) => row.reading?.tone === 'attention' && row.n >= 4,
    )
    if (uncovered.length > 0) {
      insights.push({
        id: 'declining',
        tone: 'attention',
        title: `${uncovered.length} technique${uncovered.length === 1 ? '' : 's'} declining over time`,
        detail: uncovered.map((row) => row.meta.name ?? row.technique).join(', '),
      })
    }

    return insights
  }, [rows])

  // A proposal is only "covering" a technique if one exists; the queue is independent of the
  // mode toggle because proposals are generated from whatever the Blue Agent last analysed.
  const proposalByTechnique = useMemo(() => {
    const map = new Map<string, { status: string }>()
    for (const proposal of proposals.proposals) map.set(proposal.technique, proposal)
    return map
  }, [proposals.proposals])

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

      <div className="space-y-6 px-6 pb-10 lg:px-8">
        {error ? (
          <Card variant="card" title="Could not load trials">
            <EmptyState title="Backend unreachable" detail={error} action={<Button size="sm" onClick={refetch}>Retry</Button>} />
          </Card>
        ) : (
          <>
            {headline.length > 0 && (
              <Card title="What stands out">
                <InsightList insights={headline} />
              </Card>
            )}

            <Card>
              {loading ? (
                <SkeletonRows rows={6} columns={4} />
              ) : rows.length === 0 ? (
                <EmptyState
                  title="No trials recorded for this mode"
                  detail="Run a batch to establish detection coverage."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {rows.map((row) => {
                    const proposal = proposalByTechnique.get(row.technique)
                    const rate = row.tpr ?? 0

                    return (
                      <li key={row.technique}>
                        <Link
                          to={`/techniques/${encodeURIComponent(row.technique)}`}
                          className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3.5 transition-colors hover:bg-surface-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="t-card text-ink">
                              {row.meta.mapped ? row.meta.name : row.technique}
                            </p>
                            <p className="t-technical mt-0.5 text-ink-faint">
                              {row.meta.mapped ? row.meta.mitreId : 'unmapped'}
                            </p>
                          </div>

                          <div className="w-28 shrink-0 text-right">
                            <p
                              className={`t-metric text-[20px] ${
                                rate < 0.5 ? 'text-red' : rate < 0.7 ? 'text-amber' : 'text-ink'
                              }`}
                            >
                              {formatPct(row.tpr, 0)}
                            </p>
                            <p className="t-secondary text-ink-muted">detection</p>
                          </div>

                          <div className="w-48 shrink-0">
                            <p className="t-secondary text-ink">
                              {row.reading ? row.reading.headline : 'Not enough trials'}
                            </p>
                            <p className="t-secondary text-ink-muted">
                              {row.reading
                                ? row.reading.strength
                                : `${row.n} trial${row.n === 1 ? '' : 's'} recorded`}
                            </p>
                          </div>

                          <div className="w-32 shrink-0">
                            {proposal ? (
                              <Badge tone={proposal.status === 'pending_approval' ? 'pending' : 'neutral'}>
                                {proposal.status === 'pending_approval'
                                  ? 'Rule proposed'
                                  : proposal.status === 'approved'
                                    ? 'Rule approved'
                                    : 'Rule rejected'}
                              </Badge>
                            ) : (
                              <span className="t-secondary text-ink-faint">No proposal</span>
                            )}
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Disclosure summary="How this ranking is calculated">
              <DisclosureText>
                Techniques are sorted by detection rate, lowest first. Detection rate is the share
                of that technique's trials in which Wazuh raised at least one alert. Trials are
                never excluded — a technique with three trials is ranked alongside one with thirty,
                so the trial count is shown on every row and a technique with fewer than four trials
                is marked as having too little data to read a trend.
              </DisclosureText>
              <DisclosureText>
                The direction column uses the same early-versus-late comparison as everywhere else
                in this dashboard. A technique can have a high overall detection rate and still be
                declining, which is why both are shown.
              </DisclosureText>
            </Disclosure>

            <p className="t-secondary text-ink-faint">
              {formatCount(rows.length)} techniques · {formatCount(trials.length)} trials in this mode
            </p>
          </>
        )}
      </div>
    </>
  )
}
