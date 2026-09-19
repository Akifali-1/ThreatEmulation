import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Disclosure, DisclosureText } from '../components/ui/Disclosure'
import { EmptyState } from '../components/ui/EmptyState'
import { ToggleGroup } from '../components/ui/Field'
import { Skeleton } from '../components/ui/Skeleton'
import { useTrialsData } from '../hooks/useTrialsData'
import { formatCount, formatPct, formatSeconds } from '../lib/format'
import { describeEps } from '../lib/insights'
import { computeEps } from '../lib/metrics/eps'
import { rollupByTechnique } from '../lib/metrics/tpr'
import { compareTechniques, describeTechnique } from '../lib/techniques'
import type { Mode } from '../lib/api/types'

const RATE_TONE = (rate: number | null) =>
  rate === null ? 'text-ink' : rate < 0.5 ? 'text-red' : rate < 0.7 ? 'text-amber' : 'text-ink'

/**
 * One card per technique.
 *
 * The human-readable technique name leads and the ATT&CK ID is secondary — the ID matters for
 * citation, the name matters for comprehension. Detection rate is the dominant number because
 * it is the thing being evaluated; detection time and trial count support it at lower weight.
 */
export default function Techniques() {
  const [mode, setMode] = useState<Mode>('agentic')
  const { trials, loading, error, refetch } = useTrialsData(mode)

  const cards = useMemo(
    () =>
      rollupByTechnique(trials)
        .sort((a, b) => compareTechniques(a.technique, b.technique))
        .map((rollup) => {
          const eps = computeEps(rollup.trials)
          return {
            ...rollup,
            meta: describeTechnique(rollup.technique),
            eps,
            reading: describeEps(eps),
          }
        }),
    [trials],
  )

  return (
    <>
      <PageHeader
        title="Techniques"
        description="How well each ATT&CK technique is detected, and whether that is changing."
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
        {loading ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[168px] w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <Card variant="card" title="Could not load techniques">
            <EmptyState
              title="Backend unreachable"
              detail={error}
              action={
                <button
                  type="button"
                  onClick={refetch}
                  className="rounded border border-border-strong bg-surface px-3 py-1.5 t-body hover:bg-surface-2"
                >
                  Retry
                </button>
              }
            />
          </Card>
        ) : cards.length === 0 ? (
          <Card variant="card">
            <EmptyState
              title="No techniques recorded"
              detail="Run a batch to establish detection coverage."
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {cards.map((card) => (
                <Link
                  key={card.technique}
                  to={`/techniques/${encodeURIComponent(card.technique)}`}
                  className="group flex flex-col rounded-lg border border-border bg-surface p-5 transition-colors hover:border-border-strong"
                >
                  <div>
                    <h3 className="t-card text-ink">
                      {card.meta.mapped ? card.meta.name : card.technique}
                    </h3>
                    <p className="t-technical mt-0.5 text-ink-faint">
                      {card.meta.mapped ? card.meta.mitreId : 'unmapped'}
                      {card.meta.mapped && ` · ${card.meta.tactic}`}
                    </p>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className={`t-metric ${RATE_TONE(card.tpr)}`}>
                        {card.tpr === null ? '—' : formatPct(card.tpr, 0)}
                      </p>
                      <p className="t-secondary mt-1 text-ink-muted">Detection rate</p>
                    </div>

                    <div className="text-right">
                      <p className="t-technical text-ink">{formatSeconds(card.medianTtd)}</p>
                      <p className="t-secondary mt-1 text-ink-muted">Median detection</p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-border pt-3">
                    <p className={`t-body ${card.reading ? 'text-ink' : 'text-ink-muted'}`}>
                      {card.reading ? card.reading.headline : 'Not enough trials to read a trend'}
                    </p>
                    <p className="t-secondary mt-0.5 text-ink-muted">
                      {card.reading
                        ? `${card.reading.strength} · ${formatCount(card.n)} trials`
                        : `${formatCount(card.n)} trial${card.n === 1 ? '' : 's'} recorded`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <Disclosure summary="How these are calculated">
              <DisclosureText>
                Detection rate is the share of a technique's trials in which Wazuh raised at least
                one alert. Median detection is the median seconds to the first alert, across trials
                that were detected — an undetected trial has no detection time to average, so
                including it would distort the figure.
              </DisclosureText>
              <DisclosureText>
                The direction line compares detection rates between the chronological early and late
                halves of that technique's trials. With fewer than four trials the halves are too
                small to mean anything, so it reads as not enough data rather than showing a number.
              </DisclosureText>
            </Disclosure>
          </>
        )}
      </div>
    </>
  )
}
