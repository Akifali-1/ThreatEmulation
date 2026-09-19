import type { TechniqueSummary, Trial } from '../api/types'

export interface AggregateStats {
  totalTrials: number
  detected: number
  /** Ratio 0..1, or null when there are no trials. */
  tpr: number | null
  /** Median seconds-to-detect across detected trials only. */
  medianTtd: number | null
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Time-to-detect values across the trials that were actually detected. */
export function ttDs(trials: Trial[]): number[] {
  return trials
    .filter((trial) => trial.detected && typeof trial.time_to_detect === 'number')
    .map((trial) => trial.time_to_detect as number)
}

/**
 * Overall stats from the raw trial list.
 *
 * Preferred over the summary rollup because it takes a true median MTTD over every detected
 * trial, rather than a median of per-technique medians (which would weight a technique with
 * 1 trial the same as one with 30).
 */
export function aggregateTrials(trials: Trial[]): AggregateStats {
  const totalTrials = trials.length
  const detected = trials.filter((trial) => trial.detected).length

  return {
    totalTrials,
    detected,
    tpr: totalTrials > 0 ? detected / totalTrials : null,
    medianTtd: median(ttDs(trials)),
  }
}

/** Fallback rollup used only when the raw trial list is unavailable. */
export function aggregateSummaries(summaries: TechniqueSummary[]): AggregateStats {
  const totalTrials = summaries.reduce((sum, s) => sum + (s.total_trials ?? 0), 0)
  const detected = summaries.reduce((sum, s) => sum + (s.detected ?? 0), 0)

  return {
    totalTrials,
    detected,
    tpr: totalTrials > 0 ? detected / totalTrials : null,
    medianTtd: median(
      summaries.map((s) => s.median_ttd).filter((v): v is number => typeof v === 'number'),
    ),
  }
}

export interface TechniqueRollup {
  technique: string
  trials: Trial[]
  n: number
  detected: number
  tpr: number | null
  medianTtd: number | null
}

/**
 * Groups trials by technique and computes per-technique stats.
 *
 * Derived from the trial list rather than /api/trials/summary so that the Trials, Techniques
 * and Compare pages all agree with the raw data, and so a technique with too few trials for
 * the summary endpoint still appears with its true N.
 */
export function rollupByTechnique(trials: Trial[]): TechniqueRollup[] {
  const grouped = new Map<string, Trial[]>()
  for (const trial of trials) {
    const bucket = grouped.get(trial.technique)
    if (bucket) bucket.push(trial)
    else grouped.set(trial.technique, [trial])
  }

  return [...grouped.entries()].map(([technique, bucket]) => {
    const detected = bucket.filter((trial) => trial.detected).length
    return {
      technique,
      trials: bucket,
      n: bucket.length,
      detected,
      tpr: bucket.length > 0 ? detected / bucket.length : null,
      medianTtd: median(ttDs(bucket)),
    }
  })
}

/** Sort helper for columns whose value may be null; nulls always sort last. */
export function compareNullable(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}
