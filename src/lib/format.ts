/** Shared display formatters. Every one of these is null-tolerant: the backend omits
 *  `delay_used`/`reasoning` in static mode and can return null `time_to_detect`. */

const DASH = '—'

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** h:MM:SS AM/PM, for log lines. */
export function formatClock(value: string | null | undefined): string {
  const date = toDate(value)
  if (!date) return DASH
  return date.toLocaleTimeString(undefined, {
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** YYYY-MM-DD HH:MM:SS, for table rows. */
/**
 * YYYY-MM-DD h:MM:SS AM/PM, for table rows.
 *
 * Built from local date components rather than toLocaleString, which keeps the ISO-ish date
 * prefix stable across locales. Trial timestamps arrive with a UTC offset, so these components
 * are already the viewer's local time.
 */
export function formatDateTime(value: string | null | undefined): string {
  const date = toDate(value)
  if (!date) return DASH
  const pad = (n: number) => String(n).padStart(2, '0')
  const hours = date.getHours()
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  const meridiem = hours < 12 ? 'AM' : 'PM'
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${hour12}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${meridiem}`
  )
}

/**
 * YYYY-MM-DD in the viewer's local calendar, for compact date cells.
 *
 * Built from local components, never by slicing the ISO string. Trial timestamps are UTC, so
 * `"2026-09-27T20:00:00+00:00".slice(0, 10)` claims the 27th when it is already the 28th in IST —
 * off by a day for every trial that lands after 18:30 local.
 */
export function formatDay(value: string | null | undefined): string {
  const date = toDate(value)
  if (!date) return DASH
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Normalises a 0..1 ratio to 0..100, tolerating a backend that already sends percentages. */
export function ratioToPercent(ratio: number | null | undefined): number | null {
  if (ratio == null || Number.isNaN(ratio)) return null
  return ratio > 1 ? ratio : ratio * 100
}

/** Renders a 0..1 ratio as a percentage. */
export function formatPct(ratio: number | null | undefined, digits = 1): string {
  const percent = ratioToPercent(ratio)
  if (percent === null) return DASH
  return `${percent.toFixed(digits)}%`
}

/** Seconds with one decimal, e.g. "4.9s". */
export function formatSeconds(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return DASH
  return `${value.toFixed(digits)}s`
}

/** Trailing-zero-trimmed seconds, e.g. "5s" / "12.4s". */
export function formatDelay(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return DASH
  return `${Number.isInteger(value) ? value : value.toFixed(1)}s`
}

export function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return DASH
  return String(value)
}

/** "2 alerts" / "1 alert". */
export function pluralAlerts(count: number | null | undefined): string {
  if (count == null) return DASH
  return `${count} ${count === 1 ? 'alert' : 'alerts'}`
}

/**
 * Copy for a WAITING countdown.
 *
 * `seconds` is the live remaining count, or null once it has run out — the backend only sends one
 * WAITING frame, so the client owns the countdown and needs a state past zero.
 *
 * The past-zero copy names what the backend is doing now rather than going blank. An earlier
 * version dropped the number and fell back to "Waiting…", which read as a hung trial: the reader
 * saw the count stop and nothing replace it.
 *
 * "delay" is the agent stalling before it executes; "observe" is it waiting on Wazuh after.
 */
export function waitLabel(phase: 'delay' | 'observe', seconds: number | null): string {
  if (phase === 'observe') {
    return seconds === null ? 'Awaiting detection…' : `Observing for ${seconds}s…`
  }
  return seconds === null ? 'Executing…' : `Waiting ${seconds}s…`
}
