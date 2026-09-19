import { formatDateTime, formatDelay, formatSeconds, pluralAlerts } from '../../lib/format'
import type { Mode, Trial } from '../../lib/api/types'
import { Badge } from '../ui/Badge'
import { TechniqueLabel } from './TechniqueLabel'

interface TrialDetailProps {
  trial: Trial
  mode: Mode
}

/**
 * Full record for one trial. Static-mode trials carry no reasoning and no injected delay, so
 * those fields are omitted rather than shown empty — the absence is a property of the run
 * mode, not missing data.
 */
export function TrialDetail({ trial, mode }: TrialDetailProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={trial.detected ? 'detected' : 'miss'} dot>
          {trial.detected ? 'Detected' : 'Not detected'}
        </Badge>
        <Badge tone="neutral">{mode} mode</Badge>
        {trial.detected && <Badge tone="neutral">{pluralAlerts(trial.num_alerts)}</Badge>}
      </div>

      <section>
        <Heading>Technique</Heading>
        <TechniqueLabel technique={trial.technique} variant="stacked" />
      </section>

      <section>
        <Heading>Measurements</Heading>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Metric label="Time to detect" value={formatSeconds(trial.time_to_detect)} />
          <Metric label="Alerts raised" value={String(trial.num_alerts ?? '—')} />
          <Metric label="Injected delay" value={mode === 'agentic' ? formatDelay(trial.delay_used) : 'n/a'} />
          <Metric label="Started" value={formatDateTime(trial.start_time)} />
        </dl>
        {mode === 'agentic' && trial.delay_used == null && (
          <p className="mt-2.5 text-[11px] leading-relaxed text-ink-faint">
            This trial predates temporal adaptation, so no delay was recorded.
          </p>
        )}
        {mode === 'static' && (
          <p className="mt-2.5 text-[11px] leading-relaxed text-ink-faint">
            The static baseline runs a fixed schedule, so no adaptive delay or agent reasoning is
            produced.
          </p>
        )}
      </section>

      {trial.reasoning && (
        <section>
          <Heading>Red agent reasoning</Heading>
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-muted">
            {trial.reasoning}
          </p>
        </section>
      )}
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
      {children}
    </h3>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="tnum mt-0.5 font-mono text-[13px] text-ink">{value}</dd>
    </div>
  )
}

/** Inline expansion used inside the trials table, for when a drawer would be too heavy. */
export function TrialReasoningInline({ trial }: { trial: Trial }) {
  if (!trial.reasoning) {
    return (
      <p className="text-[12px] text-ink-faint">
        No reasoning recorded for this trial — static-mode runs do not produce it.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4">
        <InlineFact label="Delay" value={formatDelay(trial.delay_used)} />
        <InlineFact label="Time to detect" value={formatSeconds(trial.time_to_detect)} />
        <InlineFact label="Alerts" value={String(trial.num_alerts ?? '—')} />
      </div>
      <p className="max-w-4xl whitespace-pre-wrap text-[12px] leading-relaxed text-ink-muted">
        {trial.reasoning}
      </p>
    </div>
  )
}

function InlineFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5 text-[11px]">
      <span className="uppercase tracking-wide text-ink-faint">{label}</span>
      <span className="tnum font-mono text-ink">{value}</span>
    </span>
  )
}
