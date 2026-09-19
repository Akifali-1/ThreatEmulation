import type { Trial } from '../api/types'

export interface TrendBucket {
  key: string
  /** Short axis label. */
  label: string
  /** Tooltip title — the full batch id or calendar date. */
  full: string
  trials: number
  detected: number
  /** Ratio 0..1, or null when the bucket has no trials. */
  tpr: number | null
  meanDelay: number | null
  /** Earliest trial in the bucket, used to order buckets chronologically. */
  startedAt: number
}

/** Which grouping the data actually supports. Stated on the page so the chart is unambiguous. */
export type TrendRule = 'batch' | 'day'

export interface TrendResult {
  buckets: TrendBucket[]
  rule: TrendRule
}

/** Local calendar day, YYYY-MM-DD. Deliberately not UTC — see `trendBuckets`. */
function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * Groups trials for the trend chart.
 *
 * Prefers `batch_id` when the backend supplies it, because a run is the unit the campaign is
 * actually organised in. Falls back to the browser's **local** calendar day — not UTC — so a
 * run that happens in the evening in IST is not split across two buckets.
 *
 * Days with no trials are omitted rather than zero-filled: a gap in the campaign is not a day
 * with 0% detection, and plotting it as one would misstate the result.
 */
export function trendBuckets(trials: Trial[]): TrendResult {
  const hasBatchIds = trials.some((trial) => trial.batch_id != null && trial.batch_id !== '')
  const rule: TrendRule = hasBatchIds ? 'batch' : 'day'

  const grouped = new Map<string, { trials: Trial[]; startedAt: number; full: string; label: string }>()

  for (const trial of trials) {
    const date = new Date(trial.start_time)
    if (Number.isNaN(date.getTime())) continue
    const startedAt = date.getTime()

    let key: string
    let label: string
    let full: string

    if (rule === 'batch') {
      const batchId = String(trial.batch_id)
      key = batchId
      full = `Batch ${batchId}`
      // Batch ids are opaque; a short suffix is enough to tell adjacent runs apart on an axis.
      label = batchId.length > 10 ? `…${batchId.slice(-8)}` : batchId
    } else {
      key = localDayKey(date)
      label = dayLabel(date)
      full = date.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    }

    const existing = grouped.get(key)
    if (existing) {
      existing.trials.push(trial)
      existing.startedAt = Math.min(existing.startedAt, startedAt)
    } else {
      grouped.set(key, { trials: [trial], startedAt, full, label })
    }
  }

  const buckets = [...grouped.entries()]
    .map(([key, group]) => {
      const detected = group.trials.filter((trial) => trial.detected).length
      const delays = group.trials
        .map((trial) => trial.delay_used)
        .filter((value): value is number => typeof value === 'number')

      return {
        key,
        label: group.label,
        full: group.full,
        trials: group.trials.length,
        detected,
        tpr: group.trials.length > 0 ? detected / group.trials.length : null,
        meanDelay:
          delays.length > 0 ? delays.reduce((sum, value) => sum + value, 0) / delays.length : null,
        startedAt: group.startedAt,
      }
    })
    // Chronological, not lexicographic: batch ids need not sort the way runs happened.
    .sort((a, b) => a.startedAt - b.startedAt)

  return { buckets, rule }
}

export const TREND_RULE_TEXT: Record<TrendRule, string> = {
  batch: 'Grouped by run (batch_id)',
  day: 'Grouped by local calendar day — no batch_id on these trials yet',
}

/**
 * Chronological trial sequence for a technique, used by the detail view's per-technique trend.
 * Returns a running TPR so the agent's adaptation is visible as a curve rather than a stack
 * of individual outcomes.
 */
export interface RunningPoint {
  index: number
  label: string
  detected: boolean
  runningTpr: number
  delay: number | null
}

export function runningTrend(trials: Trial[]): RunningPoint[] {
  const ordered = [...trials].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  )

  let detectedCount = 0
  return ordered.map((trial, index) => {
    if (trial.detected) detectedCount += 1
    return {
      index: index + 1,
      label: `${index + 1}`,
      detected: trial.detected,
      runningTpr: detectedCount / (index + 1),
      delay: trial.delay_used ?? null,
    }
  })
}
