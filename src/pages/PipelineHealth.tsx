import { useMemo } from 'react'

import { PageHeader } from '../components/layout/PageHeader'
import { InsightList } from '../components/ui/Insight'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Disclosure, DisclosureText } from '../components/ui/Disclosure'
import { KpiCard, KpiGrid } from '../components/ui/Kpi'
import { StatusRow, VerdictBanner, type ServiceState } from '../components/ui/Status'
import { useHealth } from '../context/HealthContext'
import { useNow } from '../hooks/useNow'
import { formatClock } from '../lib/format'
import { agentHealth, pipelineReading, type AgentHealth } from '../lib/insights'
import { lastDetection, minutesSinceLatest, missStreak } from '../lib/metrics/streaks'

/**
 * How each agent verdict reads.
 *
 * "Not ready" is kept distinct from "offline" on purpose. Both stop the run, but an untrusted
 * agent is the one that fails silently — it accepts the task and never executes it — so a reader
 * hunting a run of false misses needs to see that word rather than a generic failure.
 */
const AGENT_HEALTH: Record<AgentHealth, { label: string; tone: string; dot: string; state: ServiceState }> = {
  ready: { label: 'Ready', tone: 'text-teal', dot: 'bg-teal', state: 'up' },
  'not-ready': { label: 'Untrusted', tone: 'text-red', dot: 'bg-red', state: 'down' },
  offline: { label: 'Offline', tone: 'text-red', dot: 'bg-red', state: 'down' },
  unknown: { label: 'Unknown', tone: 'text-ink-muted', dot: 'bg-ink-faint', state: 'unknown' },
}

/**
 * Whether the experiment pipeline is working.
 *
 * The verdict comes first and occupies the top of the page, because that is the only question
 * a reader arrives with. Diagnostics — raw endpoints, connection counts, probe timestamps —
 * are real and useful, but they answer a follow-up question, so they sit behind a disclosure.
 */
export default function PipelineHealth() {
  const health = useHealth()
  const now = useNow()
  const trials = health.agentic.trials
  const loading = health.agentic.loading && trials.length === 0

  const streak = useMemo(() => missStreak(trials), [trials])
  const lastDetected = useMemo(() => lastDetection(trials), [trials])
  const staleMinutes = useMemo(() => minutesSinceLatest(trials), [trials])

  const socketUp = health.checked ? health.reachable : false
  const caldera = health.status?.caldera
  const wazuh = health.status?.wazuh
  const calderaAgent = caldera?.agent ?? null
  const agentState = agentHealth(calderaAgent)

  const reading = useMemo(
    () =>
      pipelineReading({
        trials,
        apiReachable: health.reachable,
        apiChecked: health.checked,
        socketConnected: socketUp,
        staleMinutes,
        calderaAlive: health.status?.caldera?.alive,
        wazuhReachable: health.status?.wazuh?.reachable,
        calderaAgent: health.status?.caldera?.agent,
      }),
    [trials, health.reachable, health.checked, health.status, socketUp, staleMinutes],
  )

  const verdictState: ServiceState =
    reading.state === 'healthy' ? 'up' : reading.state === 'attention' ? 'degraded' : 'down'

  const services = [
    {
      name: 'Backend API',
      state: (!health.checked ? 'unknown' : health.reachable ? 'up' : 'down') as ServiceState,
    },
    { name: 'Log stream', state: (socketUp ? 'up' : 'unknown') as ServiceState },
    {
      name: 'Caldera',
      state: (caldera?.alive === undefined
        ? 'unknown'
        : caldera.alive
          ? 'up'
          : 'down') as ServiceState,
    },
    {
      name: 'Wazuh',
      state: (wazuh?.reachable === undefined
        ? 'unknown'
        : wazuh.reachable
          ? 'up'
          : 'down') as ServiceState,
    },
    {
      name: 'Caldera agent',
      state: AGENT_HEALTH[agentState].state,
      // Overrides the generic "Reachable"/"Unreachable": an agent can answer and still be
      // untrusted, and calling that unreachable would name the wrong fault.
      label: AGENT_HEALTH[agentState].label,
      detail: calderaAgent?.paw,
    },
  ]

  const relativeLastTrial = useMemo(() => {
    if (staleMinutes === null) return '—'
    if (staleMinutes < 1) return 'just now'
    if (staleMinutes < 60) return `${Math.round(staleMinutes)}m ago`
    return `${Math.round(staleMinutes / 60)}h ago`
  }, [staleMinutes])

  /**
   * The backend's own last-alert timestamp when it reports one, otherwise the newest detected
   * trial. The backend value is authoritative — it comes from Wazuh rather than from the trial
   * records, so it stays correct even for activity the dashboard never recorded.
   */
  const lastAlert = useMemo(() => {
    const reported = health.status?.wazuh?.last_alert
    if (reported) {
      const at = new Date(reported)
      if (!Number.isNaN(at.getTime())) return { at, source: 'Wazuh' as const }
    }
    if (lastDetected) {
      const at = new Date(lastDetected.start_time)
      if (!Number.isNaN(at.getTime())) return { at, source: 'trial records' as const }
    }
    return null
  }, [health.status?.wazuh?.last_alert, lastDetected])

  const relativeLastAlert = useMemo(() => {
    if (!lastAlert) return '—'
    const minutes = (now - lastAlert.at.getTime()) / 60_000
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${Math.round(minutes)}m ago`
    if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`
    return `${Math.round(minutes / (60 * 24))}d ago`
  }, [lastAlert, now])

  return (
    <>
      <PageHeader
        title="Pipeline Health"
        description="Whether the emulation and detection pipeline is working, and whether misses are real."
        actions={
          <Button size="sm" onClick={health.refresh} disabled={health.agentic.loading}>
            Refresh
          </Button>
        }
      />

      <div className="space-y-8 px-6 pb-12 lg:px-8">
        <VerdictBanner
          state={verdictState}
          headline={loading ? 'Checking systems…' : reading.headline}
          detail={loading ? undefined : reading.detail}
        >
          <StatusRow services={services} />
        </VerdictBanner>

        {/* Pre-flight, above the notes: an unready agent invalidates every result that follows
            it, so it belongs before anything that describes those results. */}
        {calderaAgent && (
          <Card title="Caldera agent">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
              <AgentFact label="Agent" value={calderaAgent.paw} />
              <AgentFact
                label="Reachability"
                value={(calderaAgent.status ?? 'unknown').toUpperCase()}
                tone={calderaAgent.status === 'alive' ? 'text-teal' : 'text-red'}
              />
              <AgentFact
                label="Trust"
                value={calderaAgent.trusted ? 'TRUSTED' : 'UNTRUSTED'}
                tone={calderaAgent.trusted ? 'text-teal' : 'text-red'}
              />
              <AgentFact
                label="Last seen"
                value={calderaAgent.last_seen ? formatClock(calderaAgent.last_seen) : '—'}
              />
              <AgentFact
                label="Health"
                value={AGENT_HEALTH[agentState].label.toUpperCase()}
                tone={AGENT_HEALTH[agentState].tone}
              />
            </dl>

            <p className="t-secondary mt-4 max-w-3xl text-ink-muted">
              The most recently seen agent in the{' '}
              <code className="t-technical">red</code> group — the one Caldera would task next.
              A trial needs it to be <span className="text-ink">alive</span> <em>and</em>{' '}
              <span className="text-ink">trusted</span>. An alive but untrusted agent accepts the
              task and never runs it, so nothing executes and the trial records as a miss with no
              alerts — the same shape as a real evasion, which is why it is checked here rather
              than inferred from the results.
            </p>
          </Card>
        )}

        {reading.insights.length > 0 && (
          <Card title="What needs attention">
            <InsightList insights={reading.insights} />
          </Card>
        )}

        <KpiGrid>
          <KpiCard
            tone="blue"
            label="Last alert"
            value={loading ? '—' : relativeLastAlert}
            description={
              lastAlert
                ? `Most recent Wazuh alert, from ${lastAlert.source}`
                : 'Wazuh has not raised an alert yet'
            }
          />
          <KpiCard
            tone="gray"
            label="Last trial"
            value={loading ? '—' : relativeLastTrial}
            description="Time since the newest recorded trial"
          />
          <KpiCard
            tone={streak.alerting ? 'red' : 'gray'}
            label="Silent misses"
            value={loading ? '—' : String(streak.current)}
            description={
              streak.alerting
                ? 'Investigate — this usually means a broken pipeline'
                : 'Nothing undetected right now'
            }
            footer={loading ? undefined : `Warns at ${streak.threshold} in a row`}
          />
          <KpiCard
            tone="gray"
            label="Longest silent run"
            value={loading ? '—' : String(streak.longest)}
            description="Historically, across all trials on record"
          />
        </KpiGrid>

        <Card title="Why a silent-miss run matters">
          <div className="max-w-3xl space-y-2.5">
            <p className="t-body text-ink-muted">
              A trial that is <strong className="font-medium text-ink">not detected but still raised
              alerts</strong> proves the pipeline worked: Sysmon and the Wazuh agent were reporting,
              and the rules simply did not correlate what they saw. That is a genuine detection gap.
            </p>
            <p className="t-body text-ink-muted">
              A trial with <strong className="font-medium text-ink">no detection and no alerts</strong>{' '}
              looks identical whether the technique evaded everything or nothing executed at all.
              One is unremarkable. A run of {streak.threshold} or more is more likely a failure than
              an evasion.
            </p>
          </div>
        </Card>

        <Disclosure summary="Technical diagnostics">
          <DisclosureText>
            Raw reachability of each endpoint the dashboard reads, plus the connection count
            reported by the backend.
          </DisclosureText>
          <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
            <Diagnostic
              label="GET /api/status"
              value={health.checked ? (health.reachable ? 'ok' : 'unreachable') : 'checking'}
            />
            <Diagnostic
              label="GET /api/trials"
              value={health.agentic.error ? 'error' : health.agentic.loading ? 'checking' : 'ok'}
            />
            <Diagnostic
              label="Caldera last seen"
              value={health.status?.caldera?.last_seen ?? 'not reported'}
            />
            <Diagnostic
              label="Wazuh last alert"
              value={health.status?.wazuh?.last_alert ?? 'not reported'}
            />
            <Diagnostic label="Open connections" value={health.connections === null ? '—' : String(health.connections)} />
            <Diagnostic label="Trials loaded" value={String(trials.length)} />
          </dl>

          {health.agentic.error && (
            <p className="t-technical mt-3 text-red">{health.agentic.error}</p>
          )}

          <DisclosureText>
            Caldera and Wazuh liveness come from the <code className="t-technical">caldera</code> and{' '}
            <code className="t-technical">wazuh</code> objects on{' '}
            <code className="t-technical">GET /api/status</code>. When those fields are absent they
            are reported as unknown rather than assumed healthy.
          </DisclosureText>
        </Disclosure>
      </div>
    </>
  )
}

/** One field of the agent record, label left and value right. */
function AgentFact({
  label,
  value,
  tone = 'text-ink',
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-1.5">
      <dt className="t-secondary text-ink-muted">{label}</dt>
      <dd className={`t-technical ${tone}`}>{value}</dd>
    </div>
  )
}

function Diagnostic({ label, value }: { label: string; value: string }) {  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-1.5">
      <dt className="t-technical text-ink-muted">{label}</dt>
      <dd className={`t-technical ${value === 'ok' ? 'text-teal' : value === 'error' || value === 'unreachable' ? 'text-red' : 'text-ink-muted'}`}>
        {value}
      </dd>
    </div>
  )
}
