import type { Trial } from '../api/types'

/**
 * A miss is a trial that was not detected *and* raised no alerts.
 *
 * The distinction matters: a detected trial proves the pipeline worked, and a miss that still
 * produced alerts proves Wazuh was alive and simply did not correlate them. Only a run of
 * trials that produced nothing at all suggests the pipeline itself has died.
 */
export function isSilentMiss(trial: Trial): boolean {
  return !trial.detected && (trial.num_alerts ?? 0) === 0
}

/** Consecutive silent misses before the UI warns. Configurable here, not per-page. */
export const MISS_STREAK_THRESHOLD = 5

export interface StreakInfo {
  /** Length of the run of silent misses ending at the most recent trial. */
  current: number
  /** Longest such run anywhere in the history. */
  longest: number
  threshold: number
  /** True when `current` has reached the threshold. */
  alerting: boolean
  /** Total trials sampled. */
  total: number
  /** The most recent trial, so the UI can say when the streak started. */
  latestStartedAt: string | null
}

function chronological(trials: Trial[]): Trial[] {
  return [...trials].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  )
}

/**
 * Measures runs of silent misses.
 *
 * `current` is counted from the end, so a batch that resumed detecting resets it to zero.
 */
export function missStreak(trials: Trial[], threshold = MISS_STREAK_THRESHOLD): StreakInfo {
  const ordered = chronological(trials)

  let current = 0
  let longest = 0
  let running = 0

  for (const trial of ordered) {
    if (isSilentMiss(trial)) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 0
    }
  }

  // Walk backwards for the *current* run, which the forward pass cannot give us.
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (!isSilentMiss(ordered[i])) break
    current += 1
  }

  return {
    current,
    longest,
    threshold,
    alerting: current >= threshold,
    total: ordered.length,
    latestStartedAt: ordered.length > 0 ? ordered[ordered.length - 1].start_time : null,
  }
}

/** Most recent detected trial, used as the "last alert" proxy pending the backend extension. */
export function lastDetection(trials: Trial[]): Trial | null {
  const detected = chronological(trials).filter((trial) => trial.detected)
  return detected.length > 0 ? detected[detected.length - 1] : null
}

/** Age of the newest trial in minutes, or null for an empty history. */
export function minutesSinceLatest(trials: Trial[]): number | null {
  const ordered = chronological(trials)
  if (ordered.length === 0) return null
  const latest = new Date(ordered[ordered.length - 1].start_time).getTime()
  if (Number.isNaN(latest)) return null
  return (Date.now() - latest) / 60_000
}
