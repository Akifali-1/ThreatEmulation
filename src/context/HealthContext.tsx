import { createContext, useContext, type ReactNode } from 'react'

import { useBackendHealth, type BackendHealth } from '../hooks/useBackendHealth'
import { useTrialsData, type UseTrialsDataResult } from '../hooks/useTrialsData'
import type { Mode } from '../lib/api/types'

interface HealthContextValue extends BackendHealth {
  /**
   * Agentic trials, fetched once at the app level.
   *
   * Pipeline Health's miss-streak warning needs trial history, and the header polls status on
   * the same cadence — sharing one instance keeps them from polling independently for
   * overlapping data.
   */
  agentic: UseTrialsDataResult
  refresh: () => void
}

const HealthContext = createContext<HealthContextValue | null>(null)

export function HealthProvider({ children }: { children: ReactNode }) {
  const health = useBackendHealth()
  const agentic = useTrialsData('agentic' as Mode)

  const value: HealthContextValue = {
    ...health,
    agentic,
    refresh: agentic.refetch,
  }

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>
}

export function useHealth(): HealthContextValue {
  const context = useContext(HealthContext)
  if (!context) throw new Error('useHealth must be used inside <HealthProvider>')
  return context
}
