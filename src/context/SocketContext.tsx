import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { useLogSocket, type UseLogSocketResult } from '../hooks/useLogSocket'
import type { LogEntry } from '../lib/api/types'

interface SocketContextValue extends UseLogSocketResult {
  /** Latest batch lifecycle event, or null before the first one arrives. */
  lastBatchStep: string | null
}

const SocketContext = createContext<SocketContextValue | null>(null)

/**
 * Owns the single WebSocket connection for the whole app.
 *
 * The header's connection indicator and the Live Operations log both read from here. Creating
 * the socket per-component would open duplicate connections and inflate the backend's own
 * `connections` count, which Pipeline Health reports on.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const socket = useLogSocket()

  const lastBatchStep = useMemo(() => {
    for (let i = socket.entries.length - 1; i >= 0; i -= 1) {
      const step = socket.entries[i].step
      if (step === 'BATCH_START' || step === 'BATCH_COMPLETE') return step
    }
    return null
  }, [socket.entries])

  const value = useMemo<SocketContextValue>(
    () => ({ ...socket, lastBatchStep }),
    [socket, lastBatchStep],
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useLogStream(): SocketContextValue {
  const context = useContext(SocketContext)
  if (!context) throw new Error('useLogStream must be used inside <SocketProvider>')
  return context
}

export type { LogEntry }
