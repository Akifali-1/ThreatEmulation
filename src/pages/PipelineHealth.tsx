import { useMemo } from 'react'

import { PageHeader } from '../components/layout/PageHeader'
import { InsightList } from '../components/ui/Insight'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Disclosure, DisclosureText } from '../components/ui/Disclosure'
import { Kpi, KpiRow } from '../components/ui/Kpi'
import { StatusRow, VerdictBanner, type ServiceState } from '../components/ui/Status'
import { useHealth } from '../context/HealthContext'
import { useNow } from '../hooks/useNow'
import { pipelineReading } from '../lib/insights'
import { lastDetection, minutesSinceLatest, missStreak } from '../lib/metrics/streaks'

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

        {reading.insights.length > 0 && (
          <Card title="What needs attention">
            <InsightList insights={reading.insights} />
          </Card>
        )}

        <Card variant="card" className="overflow-hidden">
          <KpiRow>
            <Kpi
              label="Last alert"
              value={loading ? '—' : relativeLastAlert}
              interpretation={
                lastAlert
                  ? `Most recent Wazuh alert, from ${lastAlert.source}`
                  : 'Wazuh has not raised an alert yet'
              }
            />
            <Kpi
              label="Last trial"
              value={loading ? '—' : relativeLastTrial}
              interpretation="Time since the newest recorded trial"
            />
            <Kpi
              label="Silent misses"
              value={loading ? '—' : String(streak.current)}
              tone={streak.alerting ? 'risk' : 'neutral'}
              interpretation={
                streak.alerting ? 'Investigate — this usually means a broken pipeline' : 'Nothing undetected right now'
              }
            />
            <Kpi
              label="Longest silent run"
              value={loading ? '—' : String(streak.longest)}
              interpretation="Historically, across all trials on record"
              evidence={loading ? undefined : `Warns at ${streak.threshold} in a row`}
            />
          </KpiRow>
        </Card>

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

function Diagnostic({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-1.5">
      <dt className="t-technical text-ink-muted">{label}</dt>
      <dd className={`t-technical ${value === 'ok' ? 'text-teal' : value === 'error' || value === 'unreachable' ? 'text-red' : 'text-ink-muted'}`}>
        {value}
      </dd>
    </div>
  )
}
