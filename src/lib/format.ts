/** Shared display formatters. Every one of these is null-tolerant: the backend omits
 *  `delay_used`/`reasoning` in static mode and can return null `time_to_detect`. */

const DASH = '—'

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** HH:MM:SS, for log lines. */
export function formatClock(value: string | null | undefined): string {
  const date = toDate(value)
  if (!date) return DASH
  return date.toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** YYYY-MM-DD HH:MM:SS, for table rows. */
export function formatDateTime(value: string | null | undefined): string {
  const date = toDate(value)
  if (!date) return DASH
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
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
