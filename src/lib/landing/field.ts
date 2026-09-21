import type { Trial } from '../api/types'
import { describeTechnique } from '../techniques'

/**
 * Geometry and statistics for the landing field.
 *
 * The field renders one vertical filament per recorded trial. Every number here comes from
 * the API — nothing is generated for appearance. The only synthetic value is each strand's
 * fracture pattern, which is a *rendering* of the evaded/not-evaded bit and is seeded from the
 * trial index so it stays identical across frames and reloads.
 */

export interface Strand {
  /** Raw technique name, used as the isolation key. */
  technique: string
  /** Short human label for legends and captions. */
  label: string
  mitreId: string
  detected: boolean
  /** Injected delay in seconds, or null when the trial predates temporal adaptation. */
  delay: number | null
  /** Seconds to first alert, when detected. */
  ttd: number | null
  alerts: number
  startTime: string
  /** Index in chronological order. */
  index: number

  /** Normalised 0..1 position under each layout. */
  chronoX: number
  delayX: number
  /** Technique lane, 0 = top. Only meaningful in the delay layout. */
  lane: number

  /** Sub-segments (start, end in 0..1) composing an evaded strand. Detected strands are whole. */
  segments: [number, number][]
  /** Stable per-strand jitter so clusters spread instead of stacking exactly. */
  jitter: number
}

export interface FieldModel {
  strands: Strand[]
  techniques: { key: string; label: string; mitreId: string; lane: number; count: number }[]
  /** Delay values present in the data, ascending — the ticks for the delay axis. */
  delayTicks: number[]
  maxDelay: number
  total: number
  detected: number
  /** Trials with no delay, which cannot be placed on the delay axis. */
  undelayed: number
}

/** Deterministic 0..1 source. Seeded so a strand's shape never changes between frames. */
function hash(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** Splits a strand into visible runs with gaps between them. Uneven, so it reads as broken. */
function fracture(seed: number): [number, number][] {
  const runs = 2 + Math.floor(hash(seed, 1) * 3) // 2–4 pieces
  const cuts: number[] = [0]
  for (let i = 1; i < runs; i += 1) {
    cuts.push(hash(seed, i + 2))
  }
  cuts.push(1)
  cuts.sort((a, b) => a - b)

  const segments: [number, number][] = []
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const start = cuts[i]
    const end = cuts[i + 1]
    // Trim each piece unevenly — the gaps are the point.
    const gapStart = (end - start) * (0.12 + hash(seed, i + 20) * 0.3)
    const gapEnd = (end - start) * (0.05 + hash(seed, i + 40) * 0.2)
    const visibleStart = start + gapStart
    const visibleEnd = Math.max(visibleStart + 0.02, end - gapEnd)
    if (visibleEnd > visibleStart) segments.push([visibleStart, visibleEnd])
  }
  return segments
}

/**
 * Builds the field model.
 *
 * Layout A (chronological) spreads trials evenly by record order — this is the true sequence
 * the campaign ran in. Layout B groups by technique into lanes and positions by injected delay.
 *
 * Trials with no delay cannot be placed in layout B. Rather than dropping them or inventing a
 * delay, they're counted in `undelayed` and rendered as an anchored band so the omission is
 * visible.
 */
export function buildField(trials: Trial[]): FieldModel {
  const ordered = [...trials].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  )

  // Techniques ordered tactic-by-tactic so lanes read deliberately, not alphabetically.
  const techniqueKeys = [...new Set(ordered.map((t) => t.technique))]
  const sortedKeys = techniqueKeys.sort((a, b) => {
    const A = describeTechnique(a)
    const B = describeTechnique(b)
    return A.mitreId.localeCompare(B.mitreId)
  })

  const laneOf = new Map(sortedKeys.map((key, i) => [key, i]))

  const delayed = ordered.filter((t) => typeof t.delay_used === 'number')
  const maxDelay = delayed.reduce((m, t) => Math.max(m, t.delay_used as number), 1)

  // Cluster trials sharing a delay so they spread around a point instead of stacking.
  const perDelayCount = new Map<string, number>()
  for (const t of delayed) {
    const k = `${t.technique}|${t.delay_used}`
    perDelayCount.set(k, (perDelayCount.get(k) ?? 0) + 1)
  }
  const perDelaySeen = new Map<string, number>()

  const strands: Strand[] = ordered.map((trial, index) => {
    const meta = describeTechnique(trial.technique)
    const delay = typeof trial.delay_used === 'number' ? trial.delay_used : null
    const lane = laneOf.get(trial.technique) ?? 0

    // Chronological: even spread across the width.
    const chronoX = ordered.length > 1 ? index / (ordered.length - 1) : 0.5

    // Delay: position by delay value, with a small fan-out for co-located trials.
    let delayX = 0
    if (delay !== null) {
      const key = `${trial.technique}|${delay}`
      const seen = perDelaySeen.get(key) ?? 0
      perDelaySeen.set(key, seen + 1)
      const count = perDelayCount.get(key) ?? 1
      // Centre the cluster on the delay position.
      const offset = count > 1 ? (seen / (count - 1) - 0.5) * 0.055 : 0
      delayX = delay / maxDelay + offset
    }

    return {
      technique: trial.technique,
      label: meta.mapped ? meta.name : trial.technique,
      mitreId: meta.mapped ? meta.mitreId : '—',
      detected: trial.detected,
      delay,
      ttd: trial.time_to_detect ?? null,
      alerts: trial.num_alerts ?? 0,
      startTime: trial.start_time,
      index,
      chronoX,
      delayX: Math.max(0, Math.min(1, delayX)),
      lane,
      segments: trial.detected ? [[0, 1]] : fracture(index + 1),
      jitter: hash(index + 1, 99),
    }
  })

  const techniques = sortedKeys.map((key) => {
    const meta = describeTechnique(key)
    return {
      key,
      label: meta.mapped ? meta.name : key,
      mitreId: meta.mapped ? meta.mitreId : '—',
      lane: laneOf.get(key) ?? 0,
      count: ordered.filter((t) => t.technique === key).length,
    }
  })

  const delayTicks = [...new Set(delayed.map((t) => t.delay_used as number))].sort((a, b) => a - b)

  return {
    strands,
    techniques,
    delayTicks,
    maxDelay,
    total: ordered.length,
    detected: ordered.filter((t) => t.detected).length,
    undelayed: ordered.length - delayed.length,
  }
}

export interface FrontierPoint {
  /** Delay in seconds. */
  delay: number
  /** Observed detection rate 0..1, or null when the bin is too thin to draw. */
  rate: number | null
  trials: number
}

/**
 * Detection rate against delay, binned.
 *
 * Bins with fewer than `minTrials` return a null rate rather than a noisy value. The renderer
 * draws those as faint individual marks and lets the curve break across them — a threshold
 * curve drawn through two-trial bins would be a line through noise.
 */
export function frontier(model: FieldModel, binWidth = 2, minTrials = 3): FrontierPoint[] {
  const bins = new Map<number, { detected: number; total: number }>()

  for (const strand of model.strands) {
    if (strand.delay === null) continue
    const bin = Math.floor(strand.delay / binWidth) * binWidth
    const entry = bins.get(bin) ?? { detected: 0, total: 0 }
    entry.total += 1
    if (strand.detected) entry.detected += 1
    bins.set(bin, entry)
  }

  return [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([delay, entry]) => ({
      delay,
      rate: entry.total >= minTrials ? entry.detected / entry.total : null,
      trials: entry.total,
    }))
}

/** Per-technique delay at which detection drops below `threshold`, if it ever does. */
export function thresholds(
  model: FieldModel,
  threshold = 0.5,
): Map<string, number | null> {
  const result = new Map<string, number | null>()

  for (const technique of model.techniques) {
    const mine = model.strands.filter((s) => s.technique === technique.key && s.delay !== null)
    if (mine.length === 0) {
      result.set(technique.key, null)
      continue
    }

    const byDelay = new Map<number, { detected: number; total: number }>()
    for (const s of mine) {
      const d = s.delay as number
      const entry = byDelay.get(d) ?? { detected: 0, total: 0 }
      entry.total += 1
      if (s.detected) entry.detected += 1
      byDelay.set(d, entry)
    }

    const crossing = [...byDelay.entries()]
      .sort((a, b) => a[0] - b[0])
      .find(([, e]) => e.total >= 2 && e.detected / e.total < threshold)

    result.set(technique.key, crossing ? crossing[0] : null)
  }

  return result
}

// ---- rolling series -------------------------------------------------------

export interface RollingPoint {
  /** Position along the chronology, 0..1. */
  t: number
  /** Mean injected delay in seconds over the window, or null if none. */
  delay: number | null
  /** Detection rate 0..1 over the window. */
  rate: number
  /** Trials in this window. */
  n: number
}

/**
 * Rolling mean delay and detection rate across the campaign.
 *
 * This is the pair the landing page is built around: how hard the agent pushed, against what
 * it actually bought. Both are drawn on their own true scale — delay against the observed
 * maximum, detection against 100% — so neither is exaggerated to make a point.
 *
 * A window rather than a cumulative mean, because the question is "what was it doing at this
 * point in the campaign", not "what has it averaged since the beginning".
 *
 * The window is wide on purpose. Detection is close to a coin flip trial-to-trial, so a narrow
 * window renders the trend as noise — which would misrepresent a flat result as a volatile one.
 * At 45 the curve shows the direction of travel without inventing smoothness the data lacks.
 */
export function rollingSeries(model: FieldModel, window = 45): RollingPoint[] {
  const ordered = [...model.strands].sort((a, b) => a.index - b.index)
  if (ordered.length === 0) return []

  const half = Math.floor(window / 2)
  const points: RollingPoint[] = []

  for (let i = 0; i < ordered.length; i += 1) {
    const from = Math.max(0, i - half)
    const to = Math.min(ordered.length, i + half + 1)
    const slice = ordered.slice(from, to)

    const delays = slice.map((s) => s.delay).filter((d): d is number => d !== null)
    const detected = slice.filter((s) => s.detected).length

    points.push({
      t: ordered.length > 1 ? i / (ordered.length - 1) : 0.5,
      delay: delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : null,
      rate: detected / slice.length,
      n: slice.length,
    })
  }

  return points
}

/** First and last window means, for the headline pair of numbers. */
export function escalation(model: FieldModel, window = 40): {
  delayFrom: number | null
  delayTo: number | null
  rateFrom: number
  rateTo: number
} {
  const ordered = [...model.strands].sort((a, b) => a.index - b.index)
  const n = Math.min(window, Math.floor(ordered.length / 2))
  if (n === 0) return { delayFrom: null, delayTo: null, rateFrom: 0, rateTo: 0 }

  const mean = (xs: Strand[]) => {
    const d = xs.map((s) => s.delay).filter((v): v is number => v !== null)
    return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null
  }
  const rate = (xs: Strand[]) => (xs.length ? xs.filter((s) => s.detected).length / xs.length : 0)

  const early = ordered.slice(0, n)
  const late = ordered.slice(-n)

  return {
    delayFrom: mean(early),
    delayTo: mean(late),
    rateFrom: rate(early),
    rateTo: rate(late),
  }
}

// ---- easing ---------------------------------------------------------------

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

/** Remaps `v` from [start, end] to 0..1, clamped. */
export const range = (v: number, start: number, end: number): number =>
  clamp01((v - start) / (end - start))
