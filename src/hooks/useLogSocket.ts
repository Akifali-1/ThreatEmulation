import { useCallback, useEffect, useRef, useState } from 'react'

import { WS_URL } from '../config'
import { toLogEntry } from '../lib/logs'
import type { LogEntry } from '../lib/api/types'

/**
 * Ring-buffer size. Log history is intentionally not persisted across reloads.
 *
 * Kept at least as large as the server's replay buffer (RECENT in api_server.py). If it were
 * smaller, a reconnect would receive more frames than it keeps and could truncate away the
 * current batch's BATCH_START, leaving the run looking like it never started.
 */
const MAX_ENTRIES = 500

export type SocketStatus = 'connecting' | 'open' | 'closed'

export interface UseLogSocketResult {
  entries: LogEntry[]
  status: SocketStatus
  clear: () => void
}

/**
 * Subscribes to the backend's live log stream.
 *
 * Reconnects with exponential backoff (capped at 15s) so the dashboard recovers on its own
 * if the backend or the Kali VM restarts mid-session.
 */
export function useLogSocket(
  onMessage?: (entry: LogEntry) => void,
  enabled = true,
): UseLogSocketResult {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting')

  const nextIdRef = useRef(0)
  const handlerRef = useRef(onMessage)

  // Held in a ref so a caller passing an inline callback doesn't tear down the socket.
  useEffect(() => {
    handlerRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!enabled) return

    let socket: WebSocket | null = null
    let reconnectTimer: number | undefined
    let disposed = false
    let attempt = 0

    const connect = () => {
      if (disposed) return
      setSocketStatus('connecting')
      socket = new WebSocket(WS_URL)

      socket.onopen = () => {
        attempt = 0
        setSocketStatus('open')
        // The server replays recent frames on connect, so anything held from a previous
        // connection would double up. Clearing first makes a reconnect rebuild history rather
        // than append a second copy of it.
        setEntries([])
      }

      socket.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') return
        const entry = toLogEntry(event.data, (nextIdRef.current += 1))
        if (!entry) return

        setEntries((previous) => {
          const next = [...previous, entry]
          return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
        })
        handlerRef.current?.(entry)
      }

      socket.onerror = () => {
        // Browsers always follow this with a close event, so backoff lives there.
      }

      socket.onclose = () => {
        setSocketStatus('closed')
        if (disposed) return
        attempt += 1
        const delay = Math.min(1000 * 2 ** Math.min(attempt, 4), 15_000)
        reconnectTimer = window.setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [enabled])

  const clear = useCallback(() => setEntries([]), [])

  // Derived rather than stored so disabling the socket needs no extra setState.
  return { entries, status: enabled ? socketStatus : 'closed', clear }
}
