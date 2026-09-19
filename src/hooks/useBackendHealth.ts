import { useEffect, useState } from 'react'

import { getStatus } from '../lib/api'
import type { StatusResponse } from '../lib/api/types'

const POLL_INTERVAL_MS = 20_000

export interface BackendHealth {
  /** null until the first probe returns, or when the backend is unreachable. */
  connections: number | null
  reachable: boolean
  /** False before the first probe resolves — distinguishes "unknown" from "down". */
  checked: boolean
  /** Full response, so Pipeline Health can read the proposed caldera/wazuh fields. */
  status: StatusResponse | null
}

const INITIAL: BackendHealth = { connections: null, reachable: false, checked: false, status: null }

/**
 * Polls GET /api/status so the chrome can show whether the backend is answering at all —
 * distinct from the WebSocket indicator, which only reflects the log stream.
 */
export function useBackendHealth(enabled = true): BackendHealth {
  const [health, setHealth] = useState<BackendHealth>(INITIAL)

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    let alive = true

    const probe = async () => {
      try {
        const result = await getStatus(controller.signal)
        if (!alive) return
        setHealth({
          connections: result.connections ?? null,
          reachable: result.status === 'ok',
          checked: true,
          status: result,
        })
      } catch {
        if (!alive) return
        setHealth({ connections: null, reachable: false, checked: true, status: null })
      }
    }

    void probe()
    const timer = window.setInterval(probe, POLL_INTERVAL_MS)

    return () => {
      alive = false
      controller.abort()
      window.clearInterval(timer)
    }
  }, [enabled])

  return health
}
