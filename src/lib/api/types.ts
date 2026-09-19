/** Backend contract. Mirrors the FastAPI responses verbatim — nothing here is invented. */

export type Mode = 'agentic' | 'static'

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
  | 'TRIAL_COMPLETE'
  | 'BATCH_START'
  | 'BATCH_COMPLETE'
  | 'ERROR'

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

export interface ComponentHealth {
  alive?: boolean
  reachable?: boolean
  last_seen?: string | null
  last_alert?: string | null
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
