import { useEffect, useMemo, useRef, useState } from 'react'

import { formatClock } from '../../lib/format'
import { extractTrial } from '../../lib/logs'
import type { LogEntry } from '../../lib/api/types'
import { Badge } from '../ui/Badge'
import { ResultInline } from './ResultBadge'

const TONE = {
  red: { dot: 'bg-red', label: 'text-red', header: 'bg-red-tint' },
  blue: { dot: 'bg-blue', label: 'text-blue', header: 'bg-blue-tint' },
} as const

interface LogStreamProps {
  title: string
  tone: 'red' | 'blue'
  entries: LogEntry[]
  emptyLabel: string
  height?: number
}

/**
 * One agent's activity column.
 *
 * Follows the tail while the user is at the bottom, and stops the moment they scroll up so
 * reading a past event is not undone by the next frame. A "jump to latest" control brings the
 * pin back.
 */
export function LogStream({ title, tone, entries, emptyLabel, height = 340 }: LogStreamProps) {
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
            entries.map((entry) => <LogLine key={entry.id} entry={entry} />)
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

function LogLine({ entry }: { entry: LogEntry }) {
  const trial = useMemo(() => extractTrial(entry.extra), [entry.extra])

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

  return (
    <div className="flex gap-2 border-b border-border px-3 py-1.5 last:border-b-0 hover:bg-surface-2">
      <span className="tnum shrink-0 font-mono text-[10.5px] text-ink-faint">
        {formatClock(entry.timestamp)}
      </span>
      <div className="min-w-0">
        <StepTag step={entry.step} />
        <p className="mt-0.5 break-words font-mono text-[11.5px] leading-snug text-ink-muted">
          {entry.message}
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
