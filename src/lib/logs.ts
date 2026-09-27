import type { LogEntry, Mode, Trial } from './api/types'

function looksLikeTrial(value: unknown): value is Trial {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.technique === 'string' && typeof record.detected === 'boolean'
}

/**
 * Pull a trial object out of a log message's `extra` payload.
 *
 * The backend's `extra` shape is documented as variable, so rather than hard-coding one key
 * we check the plausible wrappers and then fall back to treating `extra` itself as the trial.
 */
export function extractTrial(extra: unknown): Trial | null {
  if (!extra || typeof extra !== 'object') return null
  const record = extra as Record<string, unknown>

  for (const key of ['trial', 'trial_result', 'result', 'data']) {
    if (looksLikeTrial(record[key])) return record[key] as Trial
  }
  if (looksLikeTrial(record)) return record as unknown as Trial
  return null
}

/**
 * Marks a zone-less timestamp as UTC.
 *
 * The backend writes log frames with `datetime.utcnow().isoformat()`, which carries no offset.
 * `new Date()` reads a string like that as local time, so every frame in the feed lands shifted
 * by the viewer's UTC difference — five and a half hours behind in IST. A frame that already
 * declares a zone is left alone, since Caldera and Wazuh both send one.
 */
function asUtc(value: string): string {
  return /(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`
}

/** Normalises a raw socket frame into a LogEntry. Returns null for unparseable payloads. */
export function toLogEntry(raw: string, id: number): LogEntry | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Not JSON — surface it as a system line rather than dropping it silently.
    return {
      id,
      source: 'system',
      step: 'ERROR',
      message: raw.slice(0, 500),
      timestamp: new Date().toISOString(),
      receivedAt: Date.now(),
      extra: null,
    }
  }

  if (!parsed || typeof parsed !== 'object') return null
  const record = parsed as Record<string, unknown>
  if (typeof record.message !== 'string') return null

  const source = record.source
  return {
    id,
    source: source === 'red' || source === 'blue' || source === 'system' ? source : 'system',
    step: typeof record.step === 'string' ? record.step : 'INFO',
    message: record.message,
    timestamp:
      typeof record.timestamp === 'string'
        ? asUtc(record.timestamp)
        : new Date().toISOString(),
    receivedAt: Date.now(),
    extra: (record.extra as Record<string, unknown> | null | undefined) ?? null,
  }
}

export interface PlannedInfo {
  technique: string
  /** Seconds the agent intends to stall before executing. */
  delay: number | null
  /** 1-based index of this trial within the batch. */
  trial: number | null
  total: number | null
}

/** Reads the TRIAL_PLANNED payload. */
export function extractPlanned(extra: unknown): PlannedInfo | null {
  if (!extra || typeof extra !== 'object') return null
  const record = extra as Record<string, unknown>
  if (typeof record.technique !== 'string' || record.technique === '') return null

  return {
    technique: record.technique,
    delay: typeof record.delay === 'number' ? record.delay : null,
    trial: typeof record.trial === 'number' ? record.trial : null,
    total: typeof record.total === 'number' ? record.total : null,
  }
}

export interface WaitingInfo {
  seconds: number
  phase: 'delay' | 'observe'
}

/**
 * Reads the WAITING payload.
 *
 * An unrecognised phase falls back to "delay" rather than rejecting the frame: the countdown is
 * the point, and an unknown phase name is not a reason to drop it.
 */
export function extractWaiting(extra: unknown): WaitingInfo | null {
  if (!extra || typeof extra !== 'object') return null
  const record = extra as Record<string, unknown>
  if (typeof record.seconds !== 'number' || !Number.isFinite(record.seconds)) return null

  return {
    seconds: Math.max(0, record.seconds),
    phase: record.phase === 'observe' ? 'observe' : 'delay',
  }
}

/**
 * Which arm of the experiment a batch belongs to.
 *
 * Only agentic runs have an agent, so the feed has to know the difference before it can say an
 * agent chose anything. The mode is not reliably in the payload — a real BATCH_START carries it
 * in the sentence ("Starting 1 trials in static mode") — so the text is checked as a fallback.
 * Null means genuinely unknown, and callers keep the agentic wording they used before.
 */
export function readBatchMode(entry: LogEntry): Mode | null {
  const extra = (entry.extra ?? {}) as Record<string, unknown>
  if (extra.mode === 'agentic' || extra.mode === 'static') return extra.mode

  const match = /\b(agentic|static)\b/i.exec(entry.message)
  return match ? (match[1].toLowerCase() as Mode) : null
}
