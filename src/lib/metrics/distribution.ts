import type { Trial } from '../api/types'

export interface CdfPoint {
  /** Time to detect, in seconds. */
  x: number
  /** Cumulative proportion of the sample at or below x, in 0..1. */
  y: number
}

/**
 * Empirical CDF of time-to-detect.
 *
 * Returns a step series suitable for a step-line chart: the value holds flat between
 * observations and jumps at each one. Emitting the duplicated x at each step is what makes
 * Recharts draw the staircase rather than a smoothed diagonal.
 */
export function ecdf(values: number[]): CdfPoint[] {
  if (values.length === 0) return []

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const points: CdfPoint[] = [{ x: sorted[0], y: 0 }]

  for (let i = 0; i < n; i += 1) {
    points.push({ x: sorted[i], y: (i + 1) / n })
    // Hold the level until the next observation so the curve is a true staircase.
    if (i + 1 < n && sorted[i + 1] !== sorted[i]) {
      points.push({ x: sorted[i + 1], y: (i + 1) / n })
    }
  }

  return points
}

export interface Quantiles {
  min: number | null
  q1: number | null
  median: number | null
  q3: number | null
  max: number | null
  n: number
}

/** Five-number summary, for the box-plot-ish comparison beside the CDF. */
export function quantiles(values: number[]): Quantiles {
  if (values.length === 0) {
    return { min: null, q1: null, median: null, q3: null, max: null, n: 0 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const at = (p: number): number => {
    const position = (sorted.length - 1) * p
    const lower = Math.floor(position)
    const upper = Math.ceil(position)
    if (lower === upper) return sorted[lower]
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
  }

  return {
    min: sorted[0],
    q1: at(0.25),
    median: at(0.5),
    q3: at(0.75),
    max: sorted[sorted.length - 1],
    n: sorted.length,
  }
}

/** Detected trials only — a time-to-detect of null is not a slow detection, it is no detection. */
export function detectedTtDs(trials: Trial[]): number[] {
  return trials
    .filter((trial) => trial.detected && typeof trial.time_to_detect === 'number')
    .map((trial) => trial.time_to_detect as number)
}
