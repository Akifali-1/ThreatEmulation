/** Backend contract. Mirrors the FastAPI responses verbatim — nothing here is invented. */

export type Mode = 'agentic' | 'static'

/**
 * Every arm the Live Operations run control can start.
 *
 * `closed_loop` is deliberately *not* part of `Mode`: the trial datasets, their endpoints and the
 * filters built on them are keyed by `agentic`/`static` only, and widening `Mode` would push a
 * third case through every one of them. Closed-Loop has its own run route and its own results
 * endpoint, so it gets its own key alongside the two arms rather than inside them.
 */
export type RunMode = Mode | 'closed_loop'

/**
 * One red-agent trial. Static-mode trials omit `reasoning` and `delay_used` entirely, and
 * carry a `mode` field that agentic trials don't — so every optional field here is genuinely
 * optional and consumers must tolerate its absence.
 */
export interface Trial {
  technique: string
  start_time: string
  detected: boolean
  num_alerts: number
  /** Seconds to first alert; null when nothing was detected. */
  time_to_detect: number | null
  /** Agentic only: the delay the red agent injected before this trial. */
  delay_used?: number | null
  /** Agentic only: the agent's free-text post-trial reasoning. */
  reasoning?: string | null
  /** Static only. */
  mode?: string
  /**
   * PENDING BACKEND ADDITION — not returned today.
   * When present, trends bucket by run instead of by calendar day.
   */
  batch_id?: string | null
}

export interface TechniqueSummary {
  technique: string
  total_trials: number
  detected: number
  /** Ratio in 0..1, not a percentage. */
  tpr: number
  median_ttd: number | null
}

export type ProposalStatus = 'pending_approval' | 'approved' | 'rejected'

export interface BlueProposal {
  /**
   * PENDING BACKEND ADDITION — not returned today.
   * When present, decisions are sent by id; otherwise the array index is used.
   */
  id?: string | null
  technique: string
  /** Ratio in 0..1. */
  detection_rate: number
  /** Markdown-ish free text from the LLM; may embed Wazuh rule XML. */
  proposal: string
  status: ProposalStatus
}

export type LogSource = 'red' | 'blue' | 'system'

export type LogStep =
  | 'PLAN'
  | 'EXECUTE'
  | 'OBSERVE'
  | 'ADAPT'
  | 'ANALYZE'
  | 'GAP_FOUND'
  | 'PROPOSE'
  | 'TRIAL_START'
  /** The agent has picked a technique and is about to start waiting. */
  | 'TRIAL_PLANNED'
  /**
   * The backend is sleeping and will not speak again until it wakes. `extra.phase` says why:
   * "delay" is the agent stalling before it executes, "observe" is it waiting on Wazuh after.
   */
  | 'WAITING'
  | 'TRIAL_COMPLETE'
  | 'BATCH_START'
  | 'BATCH_COMPLETE'
  | 'ERROR'
  /* Closed-Loop mode. One cycle is CYCLE_START → WAITING → RED_RESULT → (blue response). */
  /** A new cycle opens; `extra.technique` names the attack. */
  | 'CYCLE_START'
  /** Red result for the cycle; `extra.detected` and `extra.ttd`. */
  | 'RED_RESULT'
  /** Blue found nothing to do this cycle. */
  | 'NO_GAP'
  /** Blue found a detection gap and is investigating. */
  | 'GAP_FOUND'
  /** Evidence behind the gap; `extra.text` (and optional `extra.source`). */
  | 'EVIDENCE'
  /** The rule the LLM proposed; `extra.llm_output`. */
  | 'RULE_PROPOSED'
  /** The proposed rule was deployed; `extra.rule_id`. */
  | 'DEPLOY'
  /** The deployed rule was kept after validation. */
  | 'KEEP'
  /** The deployed rule was rolled back after validation. */
  | 'ROLLBACK'

/** One frame off /ws/logs. The shape of `extra` varies by step. */
export interface LogMessage {
  source: LogSource
  step: LogStep | string
  message: string
  timestamp: string
  extra?: Record<string, unknown> | null
}

/** A log message as held in client state; `id` is a monotonic React key. */
export interface LogEntry extends LogMessage {
  id: number
  /**
   * Local arrival time, in epoch ms.
   *
   * Distinct from `timestamp`, which is the backend's clock. A WAITING frame starts a countdown
   * the client runs itself, and anchoring that to the backend's clock would make it wrong by
   * whatever the two machines disagree by — up to showing zero seconds immediately.
   */
  receivedAt: number
}

export interface BlueAnalysisResponse {
  gaps: unknown[]
  proposals: BlueProposal[]
}

export interface RunBatchResponse {
  status: string
  mode: Mode
  num_trials: number
}

/** POST /api/run-closed-loop. Cycles, not trials — it is the closed-loop control's own unit. */
export interface RunClosedLoopResponse {
  status: string
  cycles: number
}

/** How Blue resolved a cycle. Unknown values fall through to a neutral rendering. */
export type BlueAction = 'keep' | 'rollback' | 'none_needed' | 'deploy_failed'

/**
 * One closed-loop cycle's recorded outcome, from GET /api/closed-loop-results.
 *
 * The baseline is the pre-fix red result; the validation is the same technique re-run after the
 * rule was deployed. `blue_action` says what Blue did about the gap it found.
 */
export interface ClosedLoopResult {
  cycle_id: string | number
  technique: string
  mitre_id?: string | null
  baseline_detected: boolean | null
  baseline_ttd?: number | null
  blue_action: BlueAction | string
  validation_detected: boolean | null
  validation_ttd?: number | null
  rule_id?: string | null
}

export interface ClosedLoopResultsResponse {
  results: ClosedLoopResult[]
}

/**
 * The Sandcat agent Caldera would task for the next trial.
 *
 * `trusted` is the field that matters. An agent can sit at `status: "alive"` and still be
 * untrusted — it is polling, but Caldera will not hand it work, so every technique silently does
 * nothing and the trial records as a miss with no alerts. That reads identically to a real
 * evasion, which is why it is surfaced rather than inferred from `alive`.
 */
export interface CalderaAgent {
  paw: string
  trusted: boolean
  /**
   * Derived server-side as `status == "alive" and trusted`. Both halves matter and neither
   * implies the other, so the backend folds them once rather than every caller re-deriving it.
   */
  ready: boolean
  status?: string | null
  host?: string | null
  group?: string | null
  last_seen?: string | null
}

export interface ComponentHealth {
  alive?: boolean
  reachable?: boolean
  last_seen?: string | null
  last_alert?: string | null
  /** Reported for `caldera` only, and only once the backend forwards it. */
  agent?: CalderaAgent | null
}

/**
 * GET /api/status.
 *
 * `caldera` and `wazuh` are a *proposed* extension that does not exist yet. They stay
 * optional so the Pipeline Health page can render a "requires backend" state instead of
 * inventing values, and nothing breaks when they appear.
 */
export interface StatusResponse {
  status: string
  connections: number
  caldera?: ComponentHealth
  wazuh?: ComponentHealth
}
