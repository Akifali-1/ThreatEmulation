import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PageHeader } from '../components/layout/PageHeader'
import { LogStream } from '../components/domain/LogStream'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState } from '../components/ui/EmptyState'
import { Field, Input, ToggleGroup } from '../components/ui/Field'
import { useLogStream } from '../context/SocketContext'
import { useTrialsData } from '../hooks/useTrialsData'
import { describeError, runBatch, runBlueAnalysis } from '../lib/api'
import { formatSeconds } from '../lib/format'
import { extractTrial } from '../lib/logs'
import { describeTechnique } from '../lib/techniques'
import type { Mode } from '../lib/api/types'

const MIN_TRIALS = 1
const MAX_TRIALS = 30
const DEFAULT_TRIALS = '5'

/** Ticks once a second while a run is active, so elapsed time advances between log frames. */
function useElapsed(since: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (since === null) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [since])

  return since === null ? null : Math.max(0, (now - since) / 1000)
}

/**
 * Start a run and watch it happen.
 *
 * Ordered by what the operator does, not by what the system knows: launch controls first, then
 * the state of the current run, then the stream. The previous layout led with two large empty
 * log panels, which told a first-time visitor nothing.
 */
export default function LiveOperations() {
  const socket = useLogStream()
  const agentic = useTrialsData('agentic')
  const staticData = useTrialsData('static')

  const [batchMode, setBatchMode] = useState<Mode>('agentic')
  const [trialsInput, setTrialsInput] = useState(DEFAULT_TRIALS)
  const [requestedTrials, setRequestedTrials] = useState<number | null>(null)
  const [startedAtIndex, setStartedAtIndex] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)
  const [blueRunning, setBlueRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = Number.parseInt(trialsInput, 10)
  const valid = Number.isFinite(parsed) && parsed >= MIN_TRIALS && parsed <= MAX_TRIALS

  const refreshAll = useCallback(() => {
    agentic.refetch()
    staticData.refetch()
  }, [agentic, staticData])

  const running = useMemo(() => {
    if (startedAtIndex === null) return socket.lastBatchStep === 'BATCH_START'

    const since = socket.entries.slice(startedAtIndex)
    const last = [...since]
      .reverse()
      .find((entry) => entry.step === 'BATCH_START' || entry.step === 'BATCH_COMPLETE')

    if (!last) return true
    return last.step === 'BATCH_START'
  }, [socket.entries, socket.lastBatchStep, startedAtIndex])

  // Refresh results when a batch finishes. Fetch only, no state, so this stays a genuine
  // sync with the external event stream.
  const lastSeenStepRef = useRef<string | null>(null)
  useEffect(() => {
    const step = socket.lastBatchStep
    if (step === lastSeenStepRef.current) return
    lastSeenStepRef.current = step
    if (step === 'BATCH_COMPLETE') refreshAll()
  }, [socket.lastBatchStep, refreshAll])

  const run = useMemo(() => {
    const since = startedAtIndex === null ? socket.entries : socket.entries.slice(startedAtIndex)
    const startEntry = since.find((entry) => entry.step === 'BATCH_START')
    const completes = since.filter((entry) => entry.step === 'TRIAL_COMPLETE')
    const latest = completes[completes.length - 1]
    const latestTrial = latest ? extractTrial(latest.extra) : null

    return {
      startedAt: startEntry ? new Date(startEntry.timestamp).getTime() : null,
      completed: completes.length,
      latestTrial,
      lastEntry: since[since.length - 1] ?? null,
    }
  }, [socket.entries, startedAtIndex])

  const elapsed = useElapsed(running && run.startedAt !== null ? run.startedAt : null)

  const startBatch = async () => {
    if (!valid || running || starting) return
    setStarting(true)
    setError(null)
    try {
      await runBatch(batchMode, parsed)
      setRequestedTrials(parsed)
      // Anchor the run to the current end of the buffer so a previous batch's BATCH_COMPLETE
      // cannot make a freshly started run look finished.
      setStartedAtIndex(socket.entries.length)
    } catch (reason) {
      setError(`Could not start the batch — ${describeError(reason)}`)
    } finally {
      setStarting(false)
    }
  }

  const startBlueAnalysis = async () => {
    setBlueRunning(true)
    setError(null)
    try {
      await runBlueAnalysis()
      refreshAll()
    } catch (reason) {
      setError(`Detection-gap analysis failed — ${describeError(reason)}`)
    } finally {
      setBlueRunning(false)
    }
  }

  const red = useMemo(() => socket.entries.filter((e) => e.source === 'red'), [socket.entries])
  const blue = useMemo(() => socket.entries.filter((e) => e.source === 'blue'), [socket.entries])
  const system = useMemo(() => socket.entries.filter((e) => e.source === 'system'), [socket.entries])
  const latestSystem = system.length > 0 ? system[system.length - 1] : null

  const latestTechnique = run.latestTrial ? describeTechnique(run.latestTrial.technique) : null

  return (
    <>
      <PageHeader
        title="Live Operations"
        description="Start an evaluation and watch the agents work."
      />

      <div className="space-y-8 px-6 pb-12 lg:px-8">
        <Card title="Run an evaluation">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <Field label="Mode">
              <ToggleGroup<Mode>
                ariaLabel="Batch run mode"
                value={batchMode}
                disabled={running}
                onChange={setBatchMode}
                options={[
                  { value: 'agentic', label: 'Agentic', activeClassName: 'text-red' },
                  { value: 'static', label: 'Static' },
                ]}
              />
            </Field>

            <Field label="Trials" hint={`${MIN_TRIALS}–${MAX_TRIALS}`}>
              <Input
                type="number"
                min={MIN_TRIALS}
                max={MAX_TRIALS}
                mono
                value={trialsInput}
                invalid={!valid}
                disabled={running}
                onChange={(event) => setTrialsInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void startBatch()
                }}
                aria-label="Number of trials"
                className="w-20"
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => void startBatch()}
                disabled={!valid || running}
                loading={starting}
              >
                {running ? 'Batch running…' : 'Start batch'}
              </Button>
              <Button onClick={() => void startBlueAnalysis()} loading={blueRunning} disabled={blueRunning}>
                Analyse detection gaps
              </Button>
            </div>
          </div>

          {!valid && (
            <p className="t-secondary mt-3 text-amber">
              Enter a whole number of trials between {MIN_TRIALS} and {MAX_TRIALS}.
            </p>
          )}
        </Card>

        {error && <ErrorState message={error} onRetry={() => setError(null)} />}

        {/* Current run — the thing the operator came here to watch. */}
        <Card
          title="Current run"
          actions={
            <Badge tone={running ? 'pending' : 'neutral'} dot className={running ? 'pulse' : ''}>
              {running ? 'Running' : 'Idle'}
            </Badge>
          }
        >
          {!running ? (
            <p className="t-body text-ink-muted">
              No run in progress. Start a batch above to stream Red Agent activity here.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              <RunFact
                label="Progress"
                value={
                  requestedTrials
                    ? `${Math.min(run.completed, requestedTrials)} of ${requestedTrials}`
                    : `${run.completed}`
                }
                sub="trials completed"
              />
              <RunFact
                label="Latest technique"
                value={latestTechnique ? latestTechnique.mitreId || run.latestTrial!.technique : '—'}
                sub={latestTechnique?.mapped ? latestTechnique.name : undefined}
              />
              <RunFact
                label="Elapsed"
                value={elapsed === null ? '—' : formatSeconds(elapsed, 0)}
                sub={run.startedAt ? 'since batch start' : 'waiting for start event'}
              />
              <RunFact
                label="Latest result"
                value={
                  run.latestTrial
                    ? run.latestTrial.detected
                      ? formatSeconds(run.latestTrial.time_to_detect)
                      : 'Not detected'
                    : 'Waiting…'
                }
                sub={run.latestTrial ? undefined : 'no trials finished yet'}
                tone={
                  run.latestTrial ? (run.latestTrial.detected ? 'detected' : 'miss') : 'muted'
                }
              />
            </dl>
          )}
        </Card>

        <Card
          title="Agent activity"
          actions={
            <Button size="sm" variant="ghost" onClick={socket.clear} disabled={socket.entries.length === 0}>
              Clear
            </Button>
          }
        >
          <div
            className={`mb-3 flex items-center gap-2.5 rounded border px-3 py-2 ${
              latestSystem?.step === 'ERROR'
                ? 'border-red-line bg-red-tint'
                : 'border-border bg-surface-2'
            }`}
          >
            <span className="t-secondary shrink-0 text-ink-muted">System</span>
            {latestSystem ? (
              <>
                <span className="t-technical shrink-0 text-ink-faint">
                  {latestSystem.timestamp.slice(11, 19)}
                </span>
                <span className="t-secondary truncate text-ink">{latestSystem.message}</span>
              </>
            ) : (
              <span className="t-secondary text-ink-muted">No system events yet</span>
            )}
          </div>

          <div className="grid grid-cols-1 overflow-hidden rounded border border-border lg:grid-cols-2 lg:divide-x lg:divide-border">
            <LogStream
              title="Red Agent"
              tone="red"
              entries={red}
              emptyLabel="No red agent activity in this session."
            />
            <LogStream
              title="Blue Agent"
              tone="blue"
              entries={blue}
              emptyLabel="No blue agent activity. Run a gap analysis to populate this."
            />
          </div>
        </Card>
      </div>
    </>
  )
}

const FACT_TONE = {
  detected: 'text-teal',
  miss: 'text-miss',
  muted: 'text-ink-muted',
} as const

function RunFact({
  label,
  value,
  sub,
  tone = 'muted',
}: {
  label: string
  value: string
  sub?: string
  tone?: keyof typeof FACT_TONE
}) {
  return (
    <div>
      <dt className="t-secondary text-ink-muted">{label}</dt>
      <dd className={`t-card mt-1 break-words ${FACT_TONE[tone]}`}>{value}</dd>
      {sub && <dd className="t-secondary mt-0.5 text-ink-faint">{sub}</dd>}
    </div>
  )
}
