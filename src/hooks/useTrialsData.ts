import { useCallback, useEffect, useState } from 'react'

import { describeError, getTrialSummary, getTrials } from '../lib/api'
import type { Mode, TechniqueSummary, Trial } from '../lib/api/types'

interface Loaded {
  mode: Mode
  trials: Trial[]
  summaries: TechniqueSummary[]
}

export interface UseTrialsDataResult {
  trials: Trial[]
  summaries: TechniqueSummary[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches the trial list and per-technique rollup for a mode.
 *
 * Loaded data is stamped with the mode it came from, so switching the toggle hides the other
 * mode's rows immediately instead of briefly showing stale values under the new tab. The two
 * requests are settled independently — one endpoint failing still lets the other render.
 */
export function useTrialsData(mode: Mode, enabled = true): UseTrialsDataResult {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  // Identifies the most recent request whose data has actually landed. `loading` is derived
  // from this rather than tracked with its own setState.
  const [settledKey, setSettledKey] = useState<string | null>(null)

  const requestKey = `${mode}|${nonce}`

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    let alive = true

    Promise.allSettled([
      getTrials(mode, controller.signal),
      getTrialSummary(mode, controller.signal),
    ]).then(([trialsResult, summaryResult]) => {
      if (!alive) return

      const problems: string[] = []
      const trials = trialsResult.status === 'fulfilled' ? trialsResult.value : []
      const summaries = summaryResult.status === 'fulfilled' ? summaryResult.value : []

      if (trialsResult.status === 'rejected') {
        problems.push(`trials — ${describeError(trialsResult.reason)}`)
      }
      if (summaryResult.status === 'rejected') {
        problems.push(`summary — ${describeError(summaryResult.reason)}`)
      }

      // Only replace the cached payload when at least one request succeeded, so a transient
      // failure doesn't wipe panels that were already populated.
      if (problems.length < 2) {
        setLoaded({ mode, trials, summaries })
      }
      setError(problems.length > 0 ? problems.join('  ·  ') : null)
      setSettledKey(requestKey)
    })

    return () => {
      alive = false
      controller.abort()
    }
  }, [mode, nonce, enabled, requestKey])

  const refetch = useCallback(() => setNonce((n) => n + 1), [])
  const current = loaded?.mode === mode ? loaded : null

  return {
    trials: current?.trials ?? [],
    summaries: current?.summaries ?? [],
    loading: enabled && settledKey !== requestKey,
    error,
    refetch,
  }
}
