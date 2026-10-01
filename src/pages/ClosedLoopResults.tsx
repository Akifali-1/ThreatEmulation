import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '../components/layout/PageHeader'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { Table, type Column } from '../components/ui/Table'
import { useLogStream } from '../context/SocketContext'
import { describeError, getClosedLoopResults } from '../lib/api'
import { formatSeconds } from '../lib/format'
import { describeTechnique, techniqueLabel } from '../lib/techniques'
import type { ClosedLoopResult } from '../lib/api/types'

/**
 * How Blue resolved a cycle, in the page's own words.
 *
 * Every action maps to a badge tone as well as a label, so the column reads at a glance. An
 * unrecognised action falls through to the raw string on a neutral badge rather than being
 * dropped — a new backend value should still show up here.
 */
const BLUE_ACTION: Record<string, { label: string; tone: BadgeTone }> = {
  keep: { label: 'Kept', tone: 'detected' },
  rollback: { label: 'Rolled back', tone: 'red' },
  none_needed: { label: 'Not needed', tone: 'neutral' },
  deploy_failed: { label: 'Deployment failed', tone: 'pending' },
}

function blueAction(action: string): { label: string; tone: BadgeTone } {
  return BLUE_ACTION[action] ?? { label: action, tone: 'neutral' }
}

/**
 * Closed-loop cycle results.
 *
 * Fetches on mount and again whenever a batch completes, so a run started on Live Operations is
 * reflected here without a manual reload. The socket is shared app-wide, so this page sees the
 * same BATCH_COMPLETE the run produced.
 */
export default function ClosedLoopResults() {
  const socket = useLogStream()
  const [results, setResults] = useState<ClosedLoopResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const rows = await getClosedLoopResults(signal)
      setResults(rows)
      setError(null)
    } catch (reason) {
      if (signal?.aborted) return
      setError(describeError(reason))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  // Refetch when a batch finishes. Guarded by the last step so a re-render does not re-issue
  // the request; the same pattern the Live Operations page uses for its own refresh.
  const lastSeenStepRef = useRef<string | null>(null)
  useEffect(() => {
    const step = socket.lastBatchStep
    if (step === lastSeenStepRef.current) return
    lastSeenStepRef.current = step
    if (step === 'BATCH_COMPLETE') void load()
  }, [socket.lastBatchStep, load])

  const columns: Column<ClosedLoopResult>[] = [
    {
      key: 'technique',
      header: 'Technique',
      sortValue: (row) => techniqueLabel(row.technique),
      cell: (row) => {
        const technique = describeTechnique(row.technique)
        // The API's own mitre_id wins when it sends one; otherwise fall back to the local mapping.
        const mitreId = row.mitre_id ?? (technique.mapped ? technique.mitreId : null)
        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{techniqueLabel(row.technique)}</p>
            {mitreId && (
              <p className="truncate font-mono text-[10.5px] text-ink-faint">{mitreId}</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'baseline',
      header: 'Baseline Detected',
      sortValue: (row) => (row.baseline_detected ? 1 : 0),
      cell: (row) => (
        <DetectionCell detected={row.baseline_detected} ttd={row.baseline_ttd ?? null} />
      ),
    },
    {
      key: 'blue_action',
      header: 'Blue Action',
      sortValue: (row) => blueAction(row.blue_action).label,
      cell: (row) => {
        const action = blueAction(row.blue_action)
        return (
          <Badge tone={action.tone} dot>
            {action.label}
          </Badge>
        )
      },
    },
    {
      key: 'validation',
      header: 'Validation Detected',
      sortValue: (row) => (row.validation_detected ? 1 : 0),
      cell: (row) => (
        <DetectionCell detected={row.validation_detected} ttd={row.validation_ttd ?? null} />
      ),
    },
    {
      key: 'rule_id',
      header: 'Rule ID',
      cell: (row) =>
        row.rule_id ? (
          <span className="font-mono text-[11.5px] text-ink">{row.rule_id}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Closed-Loop Results"
        description="Each cycle's red attack, what Blue did about the gap, and whether the deployed rule closed it."
        actions={
          <>
            <Button onClick={() => void load()} loading={loading} icon={<Icon name="refresh" size={14} />}>
              Refresh
            </Button>
            <Link
              to="/live"
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded border border-border-strong bg-surface px-3 text-[12px] font-medium text-ink transition-colors hover:bg-surface-2"
            >
              Run a cycle
              <Icon name="chevronRight" size={13} />
            </Link>
          </>
        }
      />

      <div className="px-6 pb-12 lg:px-8">
        {error && (
          <div className="mb-4">
            <ErrorState message={error} onRetry={() => void load()} />
          </div>
        )}

        <Card title="Cycles" variant="card" flush bodyClassName="overflow-hidden">
          <Table
            columns={columns}
            rows={results}
            rowKey={(row, index) => `${row.cycle_id ?? index}`}
            loading={loading}
            skeletonRows={6}
            empty={
              <EmptyState
                title="No closed-loop cycles recorded yet"
                detail="Start a Closed-Loop run from Live Operations to populate this table."
              />
            }
          />
        </Card>
      </div>
    </>
  )
}

/** A detection cell: a badge for the verdict and the time-to-detect beneath it when there is one. */
function DetectionCell({ detected, ttd }: { detected: boolean | null; ttd: number | null }) {
  if (detected === null || detected === undefined) {
    return <span className="text-ink-faint">—</span>
  }
  return (
    <div className="flex flex-col gap-0.5">
      <Badge tone={detected ? 'detected' : 'miss'}>{detected ? 'Detected' : 'Not detected'}</Badge>
      {detected && ttd !== null && (
        <span className="tnum font-mono text-[10.5px] text-ink-muted">{formatSeconds(ttd)}</span>
      )}
    </div>
  )
}
