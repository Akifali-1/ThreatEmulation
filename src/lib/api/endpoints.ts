import { API_BASE } from '../../config'
import { request, requestArray } from './client'
import type {
  BlueAnalysisResponse,
  BlueProposal,
  ClosedLoopResult,
  ClosedLoopResultsResponse,
  Mode,
  ProposalStatus,
  RunBatchResponse,
  RunClosedLoopResponse,
  StatusResponse,
  TechniqueSummary,
  Trial,
} from './types'

export function getTrials(mode: Mode, signal?: AbortSignal): Promise<Trial[]> {
  return requestArray<Trial>(`/api/trials?mode=${mode}`, signal)
}

export function getTrialSummary(mode: Mode, signal?: AbortSignal): Promise<TechniqueSummary[]> {
  return requestArray<TechniqueSummary>(`/api/trials/summary?mode=${mode}`, signal)
}

export function getBlueProposals(signal?: AbortSignal): Promise<BlueProposal[]> {
  return requestArray<BlueProposal>('/api/blue-proposals', signal)
}

/**
 * Decide a proposal.
 *
 * The backend currently addresses proposals by array index. Once it returns a stable `id` per
 * proposal, callers pass that instead and the index is only a fallback — so this works before
 * and after the backend change with no further frontend work. The route and body shape are
 * unchanged; only which target key is sent differs.
 */
export function updateProposalStatus(
  target: { index: number; id?: string | null },
  status: ProposalStatus,
): Promise<unknown> {
  const body =
    target.id != null ? { id: target.id, status } : { index: target.index, status }

  return request<unknown>('/api/blue-proposals/update', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function runBatch(mode: Mode, numTrials: number): Promise<RunBatchResponse> {
  return request<RunBatchResponse>('/api/run-batch', {
    method: 'POST',
    body: JSON.stringify({ mode, num_trials: numTrials }),
  })
}

export function runBlueAnalysis(): Promise<BlueAnalysisResponse> {
  return request<BlueAnalysisResponse>('/api/run-blue-analysis', { method: 'POST' })
}

/**
 * POST /api/run-closed-loop.
 *
 * Cycles are sent under the backend's `num_trials` key — the route reuses the batch body shape,
 * but the unit it counts is a cycle, not a trial.
 */
export function runClosedLoop(numCycles: number): Promise<RunClosedLoopResponse> {
  return request<RunClosedLoopResponse>('/api/run-closed-loop', {
    method: 'POST',
    body: JSON.stringify({ num_trials: numCycles }),
  })
}

/**
 * GET /api/closed-loop-results.
 *
 * The endpoint wraps the rows in `{ results: [...] }`; the response is unwrapped here so callers
 * get the list, and a missing or non-array `results` degrades to an empty list rather than a
 * crash deep inside the table.
 */
export function getClosedLoopResults(signal?: AbortSignal): Promise<ClosedLoopResult[]> {
  return request<ClosedLoopResultsResponse>('/api/closed-loop-results', { signal }).then((body) =>
    Array.isArray(body?.results) ? body.results : [],
  )
}

/**
 * GET /api/status.
 *
 * `caldera` and `wazuh` do not exist on the backend yet — callers must treat them as optional
 * and render an explicit unavailable state rather than assuming a value.
 */
export function getStatus(signal?: AbortSignal): Promise<StatusResponse> {
  return request<StatusResponse>('/api/status', { signal })
}

export type ChartName = 'tpr-comparison' | 'mttd-cdf' | 'eps-by-technique'

/**
 * URL for a matplotlib-rendered figure.
 *
 * These routes are pending on the backend. The page builds `<img>` sources straight from here
 * so the figures appear with no frontend change once the routes exist. `bust` appends a
 * cache-busting param for the Regenerate action.
 */
export function chartUrl(name: ChartName, bust?: number): string {
  const base = `${API_BASE}/api/charts/${name}`
  return bust === undefined ? base : `${base}?t=${bust}`
}

/** Raw endpoint URL, for download links and health probes that bypass the JSON client. */
export function endpointUrl(path: string): string {
  return `${API_BASE}${path}`
}
