import { useEffect, useRef, useState } from 'react'

import { formatClock, waitLabel } from '../../lib/format'
import { extractPlanned, extractTrial, extractWaiting } from '../../lib/logs'
import type { LogEntry, RunMode } from '../../lib/api/types'
import { Badge } from '../ui/Badge'
import { Disclosure } from '../ui/Disclosure'
import { ResultInline } from './ResultBadge'
import { RuleXml } from './RuleXml'

const TONE = {
  red: { dot: 'bg-red', label: 'text-red', header: 'bg-red-tint' },
  blue: { dot: 'bg-blue', label: 'text-blue', header: 'bg-blue-tint' },
} as const

/** The live countdown: which entry is counting, and what it should read. */
export interface Counting {
  id: number
  text: string
}

interface LogStreamProps {
  title: string
  tone: 'red' | 'blue'
  entries: LogEntry[]
  emptyLabel: string
  height?: number
  /**
   * The entry whose countdown is running right now, with the label to draw for it.
   *
   * The countdown is rendered *on* the WAITING entry rather than as a separate row, so a trial
   * reads as its own block of entries instead of gaining an extra one. Once the trial closes this
   * goes null and the entry falls back to the wait it originally announced.
   */
  counting?: Counting | null
  /** Which arm the batch is, so the plan line does not credit an agent that is not there. */
  mode?: RunMode | null
}

/**
 * One agent's activity column.
 *
 * Follows the tail while the user is at the bottom, and stops the moment they scroll up so
 * reading a past event is not undone by the next frame. A "jump to latest" control brings the
 * pin back.
 *
 * Entries are grouped before rendering. A flat list of TRIAL_PLANNED / WAITING / TRIAL_COMPLETE
 * frames gives no way to tell where one trial ends and the next begins, or which batch either
 * belongs to — the structure is already in the frames, so it is drawn rather than implied.
 */
export function LogStream({
  title,
  tone,
  entries,
  emptyLabel,
  // Tall by default: on the Live page this pair of columns is the thing the operator actually
  // watches, and a short viewport turns it into a peek at the last few frames.
  height = 500,
  counting = null,
  mode = null,
}: LogStreamProps) {
  const theme = TONE[tone]
  const bodyRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const [pinned, setPinned] = useState(true)

  useEffect(() => {
    const element = bodyRef.current
    if (element && pinnedRef.current) element.scrollTop = element.scrollHeight
  }, [entries])

  const handleScroll = () => {
    const element = bodyRef.current
    if (!element) return
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 24
    pinnedRef.current = atBottom
    setPinned(atBottom)
  }

  const jumpToLatest = () => {
    const element = bodyRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
    pinnedRef.current = true
    setPinned(true)
  }

  return (
    <div className="flex min-w-0 flex-col">
      <div className={`flex items-center gap-2 border-b border-border px-3 py-1.5 ${theme.header}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} aria-hidden="true" />
        <span className={`text-[11.5px] font-semibold ${theme.label}`}>{title}</span>
        <span className="tnum ml-auto font-mono text-[10.5px] text-ink-muted">{entries.length}</span>
      </div>

      <div className="relative">
        <div
          ref={bodyRef}
          onScroll={handleScroll}
          style={{ height }}
          className="scroll-thin overflow-y-auto bg-surface"
          role="log"
          aria-label={`${title} activity`}
        >
          {entries.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11.5px] text-ink-faint">{emptyLabel}</p>
          ) : (
            groupRows(entries).map((row) => {
              if (row.kind === 'batch') return <BatchDivider key={`b${row.entry.id}`} entry={row.entry} />
              if (row.kind === 'trial') {
                return (
                  <TrialBlock
                    key={`t${row.entries[0].id}`}
                    group={row}
                    counting={counting}
                    mode={mode}
                  />
                )
              }
              return (
                <LogLine
                  key={row.entry.id}
                  entry={row.entry}
                  counting={counting?.id === row.entry.id ? counting.text : null}
                  mode={mode}
                />
              )
            })
          )}
        </div>

        {!pinned && entries.length > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border-strong bg-surface px-2.5 py-0.5 text-[10.5px] text-ink-muted hover:bg-surface-2"
          >
            ↓ Jump to latest
          </button>
        )}
      </div>
    </div>
  )
}

interface TrialGroup {
  kind: 'trial'
  label: string
  entries: LogEntry[]
  complete: boolean
}

type Row = { kind: 'entry'; entry: LogEntry } | { kind: 'batch'; entry: LogEntry } | TrialGroup

/**
 * Folds the flat frame list into batch dividers and trial blocks.
 *
 * A trial runs from its TRIAL_PLANNED to its TRIAL_COMPLETE, and anything in between belongs to
 * it — including both WAITING phases, which is why a trial can hold four entries and still be one
 * unit. A trial with no closing frame is still emitted, so a run in progress is visible as such
 * rather than vanishing until it finishes.
 */
function groupRows(entries: LogEntry[]): Row[] {
  const rows: Row[] = []
  let trial: LogEntry[] | null = null
  let label = 'Trial'

  const flush = (complete: boolean) => {
    if (!trial) return
    rows.push({ kind: 'trial', label, entries: trial, complete })
    trial = null
  }

  for (const entry of entries) {
    if (entry.step === 'TRIAL_PLANNED') {
      flush(false)
      const planned = extractPlanned(entry.extra)
      label =
        planned?.trial != null && planned.total != null
          ? `Trial ${planned.trial} of ${planned.total}`
          : 'Trial'
      trial = [entry]
      continue
    }

    if (trial) {
      trial.push(entry)
      if (entry.step === 'TRIAL_COMPLETE' || entry.step === 'ERROR') flush(true)
      continue
    }

    if (entry.step === 'BATCH_START' || entry.step === 'BATCH_COMPLETE') {
      rows.push({ kind: 'batch', entry })
      continue
    }

    rows.push({ kind: 'entry', entry })
  }

  flush(false)
  return rows
}

/** Separates one batch from the next, and states what it was. */
function BatchDivider({ entry }: { entry: LogEntry }) {
  const extra = (entry.extra ?? {}) as Record<string, unknown>
  const mode = typeof extra.mode === 'string' ? extra.mode : null
  const total =
    typeof extra.num_trials === 'number'
      ? `${extra.num_trials} trial${extra.num_trials === 1 ? '' : 's'}`
      : null
  const closing = entry.step === 'BATCH_COMPLETE'
  const detail = [mode, total].filter(Boolean).join(' · ')

  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface-3 px-3 py-1.5">
      <span
        className={`font-mono text-[10px] tracking-wider uppercase ${
          closing ? 'text-ink-faint' : 'text-ink-muted'
        }`}
      >
        {closing ? 'Batch complete' : 'Batch'}
      </span>
      <span className="truncate text-[11px] text-ink-muted">{detail || entry.message}</span>
      <span className="tnum ml-auto shrink-0 font-mono text-[10px] text-ink-faint">
        {formatClock(entry.timestamp)}
      </span>
    </div>
  )
}

/** One trial: its plan, its waits, and its result, bracketed as a single unit. */
function TrialBlock({
  group,
  counting,
  mode,
}: {
  group: TrialGroup
  counting: Counting | null
  mode: RunMode | null
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 bg-surface-2 px-3 py-1">
        <span className="font-mono text-[10px] tracking-wide text-ink-faint uppercase">
          {group.label}
        </span>
        {!group.complete && (
          <>
            <span className="pulse h-1.5 w-1.5 rounded-full bg-red" aria-hidden="true" />
            <span className="text-[10.5px] text-red">in progress</span>
          </>
        )}
      </div>
      <div className="border-l-2 border-red-line">
        {group.entries.map((entry) => (
          <LogLine
            key={entry.id}
            entry={entry}
            counting={counting?.id === entry.id ? counting.text : null}
            mode={mode}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Copy for the steps whose meaning is in `extra` rather than the backend's sentence.
 *
 * TRIAL_PLANNED and WAITING both carry structured payloads; naming the technique and the reason
 * for the wait is more useful than the prose the backend also sends.
 */
function lineText(entry: LogEntry, mode: RunMode | null): string {
  if (entry.step === 'TRIAL_PLANNED') {
    const planned = extractPlanned(entry.extra)
    if (!planned) return entry.message
    // The static baseline has no agent — it replays a fixed script. Crediting a choice to it
    // would misdescribe the control arm of the experiment.
    return mode === 'static' ? `Scripted: ${planned.technique}` : `Agent chose ${planned.technique}`
  }
  if (entry.step === 'WAITING') {
    const waiting = extractWaiting(entry.extra)
    if (waiting) return waitLabel(waiting.phase, waiting.seconds)
  }
  // Closed-loop steps whose meaning is in `extra` rather than the backend's sentence.
  if (entry.step === 'CYCLE_START') {
    const technique = extraString(entry, 'technique')
    return technique ? `Red attacking ${technique}` : entry.message
  }
  if (entry.step === 'RED_RESULT') {
    const detected = extraField(entry, 'detected')
    if (typeof detected === 'boolean') return detected ? 'Detected' : 'Not detected'
  }
  if (entry.step === 'NO_GAP') return 'No gap, Blue not needed'
  if (entry.step === 'GAP_FOUND') return 'Gap found, Blue investigating'
  if (entry.step === 'DEPLOY') {
    const ruleId = extraString(entry, 'rule_id')
    return ruleId ? `Deployed rule ${ruleId}` : 'Rule deployed'
  }
  return entry.message
}

/** Reads one field off a frame's `extra`, tolerating a missing or non-object payload. */
function extraField(entry: LogEntry, key: string): unknown {
  const extra = entry.extra
  if (!extra || typeof extra !== 'object') return undefined
  return (extra as Record<string, unknown>)[key]
}

function extraString(entry: LogEntry, key: string): string | null {
  const value = extraField(entry, key)
  return typeof value === 'string' && value !== '' ? value : null
}

/** Clips a long value so a nested payload cannot push the rest of the feed off screen. */
function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function LogLine({
  entry,
  counting,
  mode,
}: {
  entry: LogEntry
  counting: string | null
  mode: RunMode | null
}) {
  const trial = extractTrial(entry.extra)

  // A trial-complete frame carries the full result, which is far more useful than the
  // human-readable sentence the backend also sends.
  if (trial) {
    return (
      <div className="border-b border-border px-3 py-1.5 last:border-b-0 hover:bg-surface-2">
        <div className="flex items-center gap-2">
          <span className="tnum font-mono text-[10.5px] text-ink-faint">
            {formatClock(entry.timestamp)}
          </span>
          <StepTag step={entry.step} />
        </div>
        <p className="mt-0.5 break-all font-mono text-[11.5px] text-ink">{trial.technique}</p>
        <ResultInline
          detected={trial.detected}
          timeToDetect={trial.time_to_detect}
          numAlerts={trial.num_alerts}
        />
      </div>
    )
  }

  // KEEP / ROLLBACK are the verdict on a deployed rule: the whole meaning is the word, so it is
  // drawn as a badge rather than run through the generic line renderer.
  if (entry.step === 'KEEP' || entry.step === 'ROLLBACK') {
    const kept = entry.step === 'KEEP'
    return (
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0 hover:bg-surface-2">
        <span className="tnum shrink-0 font-mono text-[10.5px] text-ink-faint">
          {formatClock(entry.timestamp)}
        </span>
        <StepTag step={entry.step} />
        <Badge tone={kept ? 'detected' : 'red'} dot>
          {kept ? 'Kept' : 'Rolled back'}
        </Badge>
      </div>
    )
  }

  // Blue's evidence: the source is context and stays on the sub-line, the excerpt is the point.
  if (entry.step === 'EVIDENCE') {
    const text = extraString(entry, 'text') ?? entry.message
    const source = extraString(entry, 'source') ?? 'Source not provided.'
    return (
      <div className="border-b border-border px-3 py-1.5 last:border-b-0 hover:bg-surface-2">
        <div className="flex items-center gap-2">
          <span className="tnum font-mono text-[10.5px] text-ink-faint">
            {formatClock(entry.timestamp)}
          </span>
          <StepTag step={entry.step} />
        </div>
        <p className="mt-0.5 break-words font-mono text-[11.5px] leading-snug text-ink">
          {truncate(text, 160)}
        </p>
        <p className="mt-0.5 text-[10.5px] text-ink-faint">{source}</p>
      </div>
    )
  }

  // The proposed rule is code, not prose — collapsed, preformatted, and left unparsed rather than
  // run through any Markdown rendering.
  if (entry.step === 'RULE_PROPOSED') {
    const rule = extraString(entry, 'llm_output') ?? entry.message
    return (
      <div className="border-b border-border px-3 py-2 last:border-b-0 hover:bg-surface-2">
        <div className="flex items-center gap-2">
          <span className="tnum font-mono text-[10.5px] text-ink-faint">
            {formatClock(entry.timestamp)}
          </span>
          <StepTag step={entry.step} />
        </div>
        <p className="mt-0.5 text-[11.5px] text-ink-muted">Proposed rule</p>
        <Disclosure summary="View proposed pattern" className="mt-1">
          <RuleXml xml={rule} />
        </Disclosure>
      </div>
    )
  }

  // The plan is the agent narrating its own choice, so it reads at full contrast; the wait it
  // then announces is machinery and stays quiet — except while it is the live countdown.
  const emphasised =
    entry.step === 'TRIAL_PLANNED' || entry.step === 'CYCLE_START' || counting !== null

  return (
    <div className="flex gap-2 border-b border-border px-3 py-1.5 last:border-b-0 hover:bg-surface-2">
      <span className="tnum shrink-0 font-mono text-[10.5px] text-ink-faint">
        {formatClock(entry.timestamp)}
      </span>
      <div className="min-w-0">
        <span className="flex items-center gap-1.5">
          {counting !== null && (
            <span className="pulse h-1.5 w-1.5 shrink-0 rounded-full bg-red" aria-hidden="true" />
          )}
          <StepTag step={entry.step} />
        </span>
        <p
          // role="timer" rather than a live region: this changes every second, and aria-live
          // would read the whole count aloud once per tick.
          {...(counting !== null
            ? { role: 'timer', 'aria-label': 'Time until the agent continues' }
            : {})}
          className={`mt-0.5 break-words font-mono text-[11.5px] leading-snug ${
            counting !== null ? 'text-red' : emphasised ? 'text-ink' : 'text-ink-muted'
          }`}
        >
          {counting ?? lineText(entry, mode)}
        </p>
      </div>
    </div>
  )
}

function StepTag({ step }: { step: string }) {
  if (step === 'ERROR') return <Badge tone="red">{step}</Badge>
  if (step === 'BATCH_START' || step === 'BATCH_COMPLETE') {
    return <Badge tone="info">{step}</Badge>
  }
  return <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">{step}</span>
}
