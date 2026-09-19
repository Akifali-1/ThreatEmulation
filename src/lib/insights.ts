import type { Trial } from './api/types'
import { formatPct, formatSeconds } from './format'
import { computeEps } from './metrics/eps'
import { aggregateTrials, rollupByTechnique } from './metrics/tpr'
import { missStreak } from './metrics/streaks'
import { describeTechnique } from './techniques'

/**
 * Insights are plain-language restatements of measurements that already exist.
 *
 * They are deliberately generated, never authored: two rules keep them honest. Each one
 * quotes a real number from the data, and none of them ranks, scores, or editorialises
 * beyond describing what the number means. If the underlying data is too thin to support a
 * statement, the insight is not emitted at all rather than hedged into vagueness.
 */

export type InsightTone = 'neutral' | 'positive' | 'attention' | 'risk'

export interface Insight {
  id: string
  tone: InsightTone
  /** The finding, in one line. */
  title: string
  /** The number behind it. */
  detail?: string
  action?: { label: string; to: string }
}

/** How strongly an EPS value should be described. Thresholds are descriptive, not a scale. */
export interface EpsReading {
  /** e.g. "Detection declined over time" */
  headline: string
  /** e.g. "Strong persistence" */
  strength: string
  tone: InsightTone
}

const EPS_FLAT_BAND = 0.05

/**
 * Descriptive word for how large an EPS value is.
 *
 * Only ever called when the value is already outside the flat band, so the weakest word here
 * is "Slight" — a "No change" rung would produce nonsense like "No change improvement".
 */
function strengthOf(magnitude: number): string {
  if (magnitude >= 0.5) return 'Strong'
  if (magnitude >= 0.25) return 'Moderate'
  return 'Slight'
}

/**
 * Turns a raw EPS value into the sentence a reader actually needs.
 *
 * Positive EPS means detection fell off between the early and late halves — the attacker's
 * evasion held. Negative means the detection side improved. This is the interpretation layer;
 * the arithmetic lives in metrics/eps.
 */
export function describeEps(eps: number | null): EpsReading | null {
  if (eps === null) return null

  if (eps > EPS_FLAT_BAND) {
    return {
      headline: 'Detection declined over time',
      strength: `${strengthOf(eps)} persistence`,
      tone: 'attention',
    }
  }
  if (eps < -EPS_FLAT_BAND) {
    return {
      headline: 'Detection improved over time',
      strength: `${strengthOf(eps)} improvement`,
      tone: 'positive',
    }
  }
  return {
    headline: 'Detection held steady',
    strength: 'No measurable change',
    tone: 'neutral',
  }
}

/** Short human name for a technique, for use in a sentence. */
function shortName(technique: string): string {
  const meta = describeTechnique(technique)
  return meta.mapped ? meta.name : technique
}

const MAX_NAMED = 3

function nameList(names: string[]): string {
  if (names.length <= MAX_NAMED) return names.join(', ')
  return `${names.slice(0, MAX_NAMED).join(', ')} and ${names.length - MAX_NAMED} more`
}

export interface OverviewInput {
  trials: Trial[]
  /** Optional: measured across both modes, for the pipeline signal on the Overview. */
  otherModeTrials?: Trial[]
}

/** Findings for the Overview page. Ordered most-consequential first. */
export function overviewInsights({ trials }: OverviewInput): Insight[] {
  if (trials.length === 0) return []

  const insights: Insight[] = []
  const stats = aggregateTrials(trials)
  const rollups = rollupByTechnique(trials)

  // 1. Headline detection.
  if (stats.tpr !== null) {
    insights.push({
      id: 'detection-rate',
      tone: stats.tpr >= 0.7 ? 'positive' : stats.tpr >= 0.5 ? 'neutral' : 'attention',
      title: `Detection is ${formatPct(stats.tpr)}`,
      detail: `${stats.detected} of ${stats.totalTrials} trials detected`,
    })
  }

  // 2. Spread across techniques — only worth saying when there is a spread to speak of.
  const rates = rollups
    .map((rollup) => ({ name: shortName(rollup.technique), tpr: rollup.tpr }))
    .filter((entry): entry is { name: string; tpr: number } => entry.tpr !== null)

  if (rates.length >= 3) {
    const sorted = [...rates].sort((a, b) => a.tpr - b.tpr)
    const low = sorted[0]
    const high = sorted[sorted.length - 1]
    const spread = high.tpr - low.tpr

    if (spread >= 0.25) {
      insights.push({
        id: 'spread',
        tone: 'attention',
        title: 'Detection varies widely across techniques',
        detail: `Ranges from ${formatPct(low.tpr, 0)} (${low.name}) to ${formatPct(high.tpr, 0)} (${high.name})`,
        action: { label: 'Compare techniques', to: '/techniques' },
      })
    } else if (spread <= 0.1) {
      insights.push({
        id: 'spread',
        tone: 'neutral',
        title: 'Detection is consistent across techniques',
        detail: `All within ${formatPct(spread, 0)} of each other`,
      })
    }
  }

  // 3. Direction of travel per technique.
  const withEps = rollups
    .filter((rollup) => rollup.n >= 4)
    .map((rollup) => ({ name: shortName(rollup.technique), eps: computeEps(rollup.trials) }))
    .filter((entry): entry is { name: string; eps: number } => entry.eps !== null)

  const declining = withEps.filter((entry) => entry.eps > EPS_FLAT_BAND)
  const improving = withEps.filter((entry) => entry.eps < -EPS_FLAT_BAND)

  if (declining.length > 0) {
    insights.push({
      id: 'declining',
      tone: declining.length >= 2 ? 'risk' : 'attention',
      title: `${declining.length} technique${declining.length === 1 ? '' : 's'} with declining detection`,
      detail: nameList(declining.map((entry) => entry.name)),
      action: { label: 'Inspect detection gaps', to: '/gaps' },
    })
  }

  if (improving.length > 0) {
    insights.push({
      id: 'improving',
      tone: 'positive',
      title: `${improving.length} technique${improving.length === 1 ? '' : 's'} with improving detection`,
      detail: nameList(improving.map((entry) => entry.name)),
    })
  }

  const thin = rollups.filter((rollup) => rollup.n < 4)
  if (thin.length > 0) {
    insights.push({
      id: 'thin',
      tone: 'neutral',
      title: `${thin.length} technique${thin.length === 1 ? '' : 's'} need more trials`,
      detail: 'Fewer than 4 trials — too few to read a trend',
    })
  }

  // 4. Latency, stated only when there is something to state.
  if (stats.medianTtd !== null) {
    insights.push({
      id: 'latency',
      tone: 'neutral',
      title: `Median detection time is ${formatSeconds(stats.medianTtd)}`,
      detail: `Across ${stats.detected} detected trials`,
    })
  }

  return insights
}

export interface PipelineInput {
  trials: Trial[]
  /** False when the last /api/status probe failed. */
  apiReachable: boolean
  apiChecked: boolean
  socketConnected: boolean
  /** Minutes since the newest trial, or null when there is no history. */
  staleMinutes: number | null
  /** undefined when the backend does not report this field yet. */
  calderaAlive?: boolean
  wazuhReachable?: boolean
}

export type PipelineState = 'healthy' | 'attention' | 'degraded'

export interface PipelineReading {
  state: PipelineState
  headline: string
  detail: string
  insights: Insight[]
}

/**
 * The single answer the Pipeline Health page owes the reader: is the experiment working?
 *
 * A long run of trials that produced no detection *and* no alerts is the signature of a dead
 * pipeline rather than successful evasion, so it dominates the verdict.
 */
export function pipelineReading({
  trials,
  apiReachable,
  apiChecked,
  socketConnected,
  staleMinutes,
  calderaAlive,
  wazuhReachable,
}: PipelineInput): PipelineReading {
  const streak = missStreak(trials)
  const insights: Insight[] = []

  if (apiChecked && !apiReachable) {
    insights.push({
      id: 'api',
      tone: 'risk',
      title: 'Backend API is unreachable',
      detail: 'Nothing on this page can be trusted until the connection is restored.',
    })
  }

  /*
   * Wazuh being down is the single most dangerous silent failure: no events means no alerts,
   * which means every trial records as "not detected" and looks like a successful evasion.
   * It is called out ahead of the streak for that reason.
   */
  if (wazuhReachable === false) {
    insights.push({
      id: 'wazuh',
      tone: 'risk',
      title: 'Wazuh is unreachable',
      detail:
        'No detections can be recorded while Wazuh is down, so any trials run now will appear as evasions. Do not treat them as results.',
    })
  }

  if (calderaAlive === false) {
    insights.push({
      id: 'caldera',
      tone: 'risk',
      title: 'Caldera is not reporting an agent',
      detail:
        'Techniques cannot be executed without a live Sandcat agent. Trials started now will not run.',
    })
  }

  if (streak.alerting) {
    insights.push({
      id: 'streak',
      tone: 'risk',
      title: `${streak.current} consecutive trials with no detection and no alerts`,
      detail:
        'This usually means the pipeline stopped working, not that the techniques evaded. Check Caldera and the Wazuh agent before recording these as evasions.',
    })
  }

  if (apiChecked && apiReachable && !socketConnected) {
    insights.push({
      id: 'socket',
      tone: 'attention',
      title: 'Live log stream is disconnected',
      detail: 'Trials already recorded are unaffected; new activity will not stream in.',
    })
  }

  if (staleMinutes !== null && staleMinutes > 60 && !streak.alerting) {
    insights.push({
      id: 'stale',
      tone: 'attention',
      title: `No new trials for ${Math.round(staleMinutes / 60)}h`,
      detail: 'Expected between batches, but worth confirming nothing is stuck.',
    })
  }

  if (streak.longest >= streak.threshold && !streak.alerting) {
    insights.push({
      id: 'historical',
      tone: 'neutral',
      title: `Longest past silent run was ${streak.longest} trials`,
      detail: 'No silent misses are occurring right now.',
    })
  }

  // A down component or a failed probe is a degraded pipeline, not a noted one.
  const degraded = (apiChecked && !apiReachable) || wazuhReachable === false || calderaAlive === false

  const state: PipelineState = degraded
    ? 'degraded'
    : streak.alerting
      ? 'degraded'
      : insights.some((insight) => insight.tone === 'attention' || insight.tone === 'risk')
        ? 'attention'
        : 'healthy'

  const headline =
    state === 'healthy'
      ? 'Pipeline operational'
      : state === 'attention'
        ? 'Pipeline operational, with notes'
        : 'Pipeline needs attention'

  const detail =
    state === 'healthy'
      ? 'All core services are reachable. No silent-miss streak.'
      : state === 'attention'
        ? 'Core services are reachable. See the notes below.'
        : 'A component is down or the connection failed. Investigate before trusting new results.'

  return { state, headline, detail, insights }
}
