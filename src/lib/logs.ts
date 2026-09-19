import type { LogEntry, Trial } from './api/types'

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
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : new Date().toISOString(),
    extra: (record.extra as Record<string, unknown> | null | undefined) ?? null,
  }
}
