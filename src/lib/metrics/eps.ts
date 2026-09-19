import type { Trial } from '../api/types'

/**
 * Evasion Persistence Score.
 *
 * Defined as the chronological early-half vs late-half split of a technique's trials:
 *
 *   sort trials by start_time
 *   mid   = floor(N / 2)
 *   early = trials[:mid], late = trials[mid:]
 *   early_rate = detected(early) / len(early)
 *   late_rate  = detected(late)  / len(late)
 *   EPS = (early_rate - late_rate) / early_rate
 *
 * Odd N: `mid = len(trials) // 2` is integer floor division, so the LATE half receives the
 * extra trial — not the early half. For N=7: mid=3, early=trials[:3] (3 trials),
 * late=trials[3:] (4 trials). Confirmed against the Python implementation.
 *
 * Positive => detection fell off over time, i.e. evasion persisted.
 * Negative => detection got easier over time.
 *
 * This mirrors the Python implementation in the backend and MUST stay in lockstep with it;
 * the UI and the paper have to report the same number. Any change here needs the same change
 * on the Python side.
 */

/** Below this many trials the halves aren't meaningful, so EPS is undefined rather than 0. */
export const EPS_MIN_TRIALS = 4

const DASH = '—'

function startTimeMs(trial: Trial): number {
  const parsed = new Date(trial.start_time).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

/** Chronological ascending. Stable for equal timestamps via the original index. */
function chronologically(trials: Trial[]): Trial[] {
  return trials
    .map((trial, index) => ({ trial, index }))
    .sort((a, b) => {
      const delta = startTimeMs(a.trial) - startTimeMs(b.trial)
      return delta !== 0 ? delta : a.index - b.index
    })
    .map((entry) => entry.trial)
}

function detectionRate(trials: Trial[]): number {
  if (trials.length === 0) return 0
  let detected = 0
  for (const trial of trials) if (trial.detected) detected += 1
  return detected / trials.length
}

/**
 * Returns null when the technique has fewer than EPS_MIN_TRIALS trials — the caller should
 * render "insufficient data" rather than a misleading zero.
 */
export function computeEps(trials: Trial[]): number | null {
  if (trials.length < EPS_MIN_TRIALS) return null

  const ordered = chronologically(trials)
  const mid = Math.floor(ordered.length / 2)
  const early = ordered.slice(0, mid)
  const late = ordered.slice(mid)

  const earlyRate = detectionRate(early)
  const lateRate = detectionRate(late)

  // Matches the Python behaviour: avoids a divide-by-zero, and "no detections early" is a
  // reasonable default of no measurable evasion change.
  if (earlyRate === 0) return 0

  return (earlyRate - lateRate) / earlyRate
}

/** Per-technique EPS keyed by the raw technique name from the API. */
export function epsByTechnique(trials: Trial[]): Map<string, number | null> {
  const grouped = new Map<string, Trial[]>()
  for (const trial of trials) {
    const bucket = grouped.get(trial.technique)
    if (bucket) bucket.push(trial)
    else grouped.set(trial.technique, [trial])
  }

  const result = new Map<string, number | null>()
  for (const [technique, bucket] of grouped) {
    result.set(technique, computeEps(bucket))
  }
  return result
}

export interface EpsHalves {
  earlyRate: number
  lateRate: number
  earlyCount: number
  lateCount: number
}

/** The intermediate rates behind an EPS value, for tooltips and the technique detail view. */
export function epsHalves(trials: Trial[]): EpsHalves | null {
  if (trials.length < EPS_MIN_TRIALS) return null

  const ordered = chronologically(trials)
  const mid = Math.floor(ordered.length / 2)
  const early = ordered.slice(0, mid)
  const late = ordered.slice(mid)

  return {
    earlyRate: detectionRate(early),
    lateRate: detectionRate(late),
    earlyCount: early.length,
    lateCount: late.length,
  }
}

/** "+0.42" / "−0.15". Uses a true minus sign so it reads correctly in tables. */
export function formatEps(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return DASH
  const rounded = value.toFixed(digits)
  return rounded.startsWith('-') ? rounded.replace('-', '−') : `+${rounded}`
}

export function formatSignedPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio == null || Number.isNaN(ratio)) return DASH
  const percent = ratio * 100
  const text = Math.abs(percent).toFixed(digits)
  return percent < 0 ? `−${text}%` : `+${text}%`
}
