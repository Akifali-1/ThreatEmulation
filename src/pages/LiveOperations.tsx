import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '../components/layout/PageHeader'
import { LogStream } from '../components/domain/LogStream'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState } from '../components/ui/EmptyState'
import { Field, Input, ToggleGroup } from '../components/ui/Field'
import { useHealth } from '../context/HealthContext'
import { useLogStream } from '../context/SocketContext'
import { useLiveTrial } from '../hooks/useLiveTrial'
import { useNow } from '../hooks/useNow'
import { useTrialsData } from '../hooks/useTrialsData'
import { describeError, runBatch, runBlueAnalysis } from '../lib/api'
import { formatClock, formatSeconds, waitLabel } from '../lib/format'
import { agentHealth } from '../lib/insights'
import { describeTechnique } from '../lib/techniques'
import type { CalderaAgent, Mode } from '../lib/api/types'

const MIN_TRIALS = 1
const MAX_TRIALS = 30
const DEFAULT_TRIALS = '5'

/**
 * Idle pages need a clock only for relative timestamps; a live run needs per-second motion for
 * the elapsed counter and the WAITING countdown. Slowing the tick when nothing is moving keeps
 * the page from re-rendering sixty times a minute for no visible change.
 */
const IDLE_TICK_MS = 60_000
const LIVE_TICK_MS = 1_000

/**
 * Steps that belong to the red agent whatever `source` the backend stamps on them.
 *
 * These arrive tagged `system`, which would leave them in the single-line system banner and out
 * of the Red Agent column entirely — so a trial's own narration never appeared next to the
 * results it produced. Routing by step as well as source puts the three beats of a trial — plan,
 * wait, result — in one column, and the banner goes back to carrying system events only.
 */
const TRIAL_NARRATION = new Set(['TRIAL_PLANNED', 'WAITING', 'TRIAL_COMPLETE'])

/**
 * Batch boundaries also live in the red column.
 *
 * They are what the feed groups around — without them the trial blocks have nothing to sit
 * inside, and a run's trials read as one undifferentiated list across every session. The system
 * banner still carries them, where they serve a different purpose: what happened most recently.
 */
const BATCH_BOUNDARY = new Set(['BATCH_START', 'BATCH_COMPLETE'])

const isRedAgent = (entry: { source: string; step: string }) =>
  entry.source === 'red' || TRIAL_NARRATION.has(entry.step) || BATCH_BOUNDARY.has(entry.step)

interface Readiness {
  state: 'ready' | 'blocked' | 'checking'
  headline: string
  detail: string
}

const READINESS_TONE: Record<Readiness['state'], { wrap: string; dot: string; text: string }> = {
  ready: { wrap: 'border-teal-line bg-teal-tint', dot: 'bg-teal', text: 'text-teal' },
  blocked: { wrap: 'border-red-line bg-red-tint', dot: 'bg-red', text: 'text-red' },
  checking: { wrap: 'border-border bg-surface-2', dot: 'bg-amber', text: 'text-ink-muted' },
}

/**
 * Whether a batch started now would produce a result worth recording.
 *
 * Mirrors the blocking conditions in the Pipeline Health verdict so the two pages cannot
 * disagree about whether the pipeline works — a run needs the backend, an agent Caldera will
 * actually task, and Wazuh to see what it does. The order is the order they break a run: the
 * backend gates everything, an untrusted agent stops execution, and Wazuh stops detection.
 *
 * This is a warning, not a lock. The backend enforces the same check server-side, so a stale
 * reading here cannot let a doomed batch through.
 */
function runReadiness(
  checked: boolean,
  apiReachable: boolean,
  agent: CalderaAgent | null | undefined,
  wazuhReachable: boolean | undefined,
): Readiness {
  if (!checked) {
    return {
      state: 'checking',
      headline: 'Checking the pipeline…',
      detail: 'Confirming the backend, the Caldera agent and Wazuh.',
    }
  }
  if (!apiReachable) {
    return {
      state: 'blocked',
      headline: 'Backend is unreachable',
      detail: 'Nothing can start until the API answers.',
    }
  }

  const state = agentHealth(agent)
  const named = agent?.paw ? `Agent ${agent.paw}` : 'The Caldera agent'

  if (state === 'not-ready') {
    return {
      state: 'blocked',
      headline: `${named} is alive but untrusted`,
      detail:
        'Caldera will not task it, so nothing would execute and the trial would read as a miss. Restart the Sandcat agent on the target first.',
    }
  }
  if (state === 'offline') {
    return {
      state: 'blocked',
      headline: `${named} is not alive`,
      detail: 'It is registered but not polling, so nothing would execute.',
    }
  }
  if (state === 'unknown') {
    return {
      state: 'checking',
      headline: 'Agent state unknown',
      detail: 'The backend is not reporting a red-group agent yet.',
    }
  }
  if (wazuhReachable === false) {
    return {
      state: 'blocked',
      headline: 'Wazuh is unreachable',
      detail: 'No detection can be recorded, so every trial would look like an evasion.',
    }
  }

  return {
    state: 'ready',
    headline: 'Ready to run',
    detail: `Agent ${agent?.paw} is trusted and Wazuh is reachable.`,
  }
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
  const health = useHealth()
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

  const readiness = runReadiness(
    health.checked,
    health.reachable,
    health.status?.caldera?.agent,
    health.status?.wazuh?.reachable,
  )

  const refreshAll = useCallback(() => {
    agentic.refetch()
    staticData.refetch()
  }, [agentic, staticData])

  // The trial in flight is a fold over the log buffer. It is kept separate from the clock below
  // so neither drives the other: the tick rate depends on whether anything is counting, which
  // would be a cycle if the clock were an input to that decision.
  const live = useLiveTrial(socket.entries, startedAtIndex)

  const ticking = live.running || live.waiting !== null
  const now = useNow(ticking ? LIVE_TICK_MS : IDLE_TICK_MS)

  const elapsed =
    live.running && live.startedAt !== null ? Math.max(0, (now - live.startedAt) / 1000) : null

  // Elapsed counts up from the current batch's own start, so a leftover mark from an earlier run
  // cannot show through. Ceil keeps the last whole second on screen instead of blinking to 0.
  const waitRemaining = live.waiting
    ? Math.max(0, Math.ceil((live.waiting.endsAt - now) / 1000))
    : null

  // Null past zero drops the number, rather than leaving a frozen "0s" that reads as stuck.
  const waitingText =
    live.waiting && waitRemaining !== null
      ? waitLabel(live.waiting.phase, waitRemaining > 0 ? waitRemaining : null)
      : null

  const running = live.running

  // Refresh results when a batch finishes. Fetch only, no state, so this stays a genuine
  // sync with the external event stream.
  const lastSeenStepRef = useRef<string | null>(null)
  useEffect(() => {
    const step = socket.lastBatchStep
    if (step === lastSeenStepRef.current) return
    lastSeenStepRef.current = step
    if (step === 'BATCH_COMPLETE') refreshAll()
  }, [socket.lastBatchStep, refreshAll])

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

  // Clearing the feed drops the anchor with it: an index past the end of an emptied buffer would
  // leave every slice short, which reads as a run that started and never finished.
  const clearFeed = () => {
    setStartedAtIndex(null)
    socket.clear()
  }

  const red = useMemo(() => socket.entries.filter((e) => isRedAgent(e)), [socket.entries])
  const blue = useMemo(() => socket.entries.filter((e) => e.source === 'blue'), [socket.entries])
  const system = useMemo(
    () => socket.entries.filter((e) => e.source === 'system' && !TRIAL_NARRATION.has(e.step)),
    [socket.entries],
  )
  const latestSystem = system.length > 0 ? system[system.length - 1] : null

  // The plan is the freshest word on what the agent is doing — TRIAL_PLANNED lands well before
  // the trial resolves, so this tracks the technique in flight rather than the last finished one.
  const techniqueName = live.planned?.technique ?? live.latestTrial?.technique ?? null
  // Only the plan vocabulary matches the feed: the card and the "Agent chose X" line have to name
  // the same thing, and the MITRE mapping is already the sub-line beneath.
  const latestTechnique = techniqueName ? describeTechnique(techniqueName) : null

  /*
   * The countdown is handed down to the WAITING entry itself rather than rendered as its own row,
   * so one trial is exactly three stacked entries — plan, wait, result — and the wait settles
   * back to the duration it announced once the trial closes.
   */
  const counting =
    live.waiting && waitingText ? { id: live.waiting.entryId, text: waitingText } : null

  /*
   * Sits beside the feed heading so the run's progress is legible from the log itself rather than
   * only from the Current run card above it. The total comes from the frames when it can — the
   * TRIAL_PLANNED frames carry it — so a refresh mid-batch does not blank the denominator the
   * way the component's own `requestedTrials` would.
   */
  const plannedTotal = live.planned?.total ?? requestedTrials
  const trialProgress = plannedTotal ? `${live.completed} of ${plannedTotal} trials completed` : null

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

          {/*
            Pre-flight, inside the card and directly under the controls, because it is only
            useful read before Start is pressed. The backend refuses the same conditions, so
            this is the warning rather than the lock.
          */}
          <div
            role="status"
            className={`mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded border px-3.5 py-2.5 ${
              READINESS_TONE[readiness.state].wrap
            }`}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${READINESS_TONE[readiness.state].dot}`}
              aria-hidden="true"
            />
            <span className={`t-card ${READINESS_TONE[readiness.state].text}`}>
              {readiness.headline}
            </span>
            <span className="t-secondary text-ink-muted">{readiness.detail}</span>
            {readiness.state === 'blocked' && (
              <Link
                to="/health"
                className="t-secondary ml-auto shrink-0 font-medium text-ink underline decoration-border-strong underline-offset-2 hover:decoration-ink"
              >
                Check Pipeline Health →
              </Link>
            )}
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
                  plannedTotal
                    ? `${Math.min(live.completed, plannedTotal)} of ${plannedTotal}`
                    : `${live.completed}`
                }
                sub="trials completed"
              />
              <RunFact
                label="Latest technique"
                // The raw name off the frame, matching the "Agent chose X" line in the feed. The
                // MITRE mapping is context, so it belongs on the sub-line rather than replacing
                // the name the feed and the agent both use.
                value={techniqueName ?? '—'}
                sub={latestTechnique?.mapped ? latestTechnique.name : undefined}
              />
              <RunFact
                label="Elapsed"
                value={elapsed === null ? '—' : formatSeconds(elapsed, 0)}
                sub={live.startedAt !== null ? 'since batch start' : 'waiting for start event'}
              />
              <RunFact
                label="Latest result"
                value={
                  live.latestTrial
                    ? live.latestTrial.detected
                      ? formatSeconds(live.latestTrial.time_to_detect)
                      : 'Not detected'
                    : 'Waiting…'
                }
                sub={live.latestTrial ? undefined : 'no trials finished yet'}
                tone={
                  live.latestTrial ? (live.latestTrial.detected ? 'detected' : 'miss') : 'muted'
                }
              />
            </dl>
          )}
        </Card>

        <Card
          title={
            <span className="flex flex-wrap items-baseline gap-x-3">
              Agent activity
              {trialProgress && (
                <span className="t-secondary font-normal text-ink-muted">{trialProgress}</span>
              )}
            </span>
          }
          actions={
            <Button size="sm" variant="ghost" onClick={clearFeed} disabled={socket.entries.length === 0}>
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
                  {formatClock(latestSystem.timestamp)}
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
              counting={counting}
              // The frame's own mode when the batch announced one, otherwise the mode this page
              // started it with — so opening the page mid-run still labels the arm correctly.
              mode={live.mode ?? (startedAtIndex !== null ? batchMode : null)}
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
