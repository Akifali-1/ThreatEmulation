import { useCallback, useEffect, useState } from 'react'

import { describeError, getBlueProposals, updateProposalStatus } from '../lib/api'
import type { BlueProposal, ProposalStatus } from '../lib/api/types'

export interface UseBlueProposalsResult {
  proposals: BlueProposal[]
  loading: boolean
  error: string | null
  /** Key of the proposal currently being decided, else null. */
  updatingKey: string | null
  refetch: () => void
  setStatus: (index: number, status: ProposalStatus, id?: string | null) => Promise<void>
}

/** Stable identity for a proposal: its backend id when it has one, else its position. */
export function proposalKey(proposal: BlueProposal, index: number): string {
  return proposal.id != null ? proposal.id : `#${index}`
}

/**
 * Proposal queue.
 *
 * Decisions are addressed by `id` when the backend supplies one and by array index otherwise.
 * The index form is fragile — if the list shifts between render and click (a blue analysis
 * completing, or the backend dropping reviewed entries), an index can point at a different
 * proposal. Callers should keep decisions disabled while a refetch is in flight. The pending
 * backend addition of a stable per-proposal id removes the hazard entirely.
 */
export function useBlueProposals(enabled = true): UseBlueProposalsResult {
  const [proposals, setProposals] = useState<BlueProposal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  // The fetch generation whose response has landed; `loading` is derived from it.
  const [settledNonce, setSettledNonce] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    let alive = true

    getBlueProposals(controller.signal)
      .then((result) => {
        if (!alive) return
        setProposals(result)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!alive) return
        setError(describeError(reason))
      })
      .finally(() => {
        if (alive) setSettledNonce(nonce)
      })

    return () => {
      alive = false
      controller.abort()
    }
  }, [nonce, enabled])

  const refetch = useCallback(() => setNonce((n) => n + 1), [])

  const setStatus = useCallback(
    async (index: number, status: ProposalStatus, id?: string | null) => {
      const key = id != null ? id : `#${index}`
      setUpdatingKey(key)
      try {
        await updateProposalStatus({ index, id }, status)
        // Patch locally for an immediate response, then reconcile with the server.
        setProposals((previous) =>
          previous.map((proposal, i) => (i === index ? { ...proposal, status } : proposal)),
        )
        setError(null)
        setNonce((n) => n + 1)
      } catch (reason) {
        setError(`Could not update proposal: ${describeError(reason)}`)
      } finally {
        setUpdatingKey(null)
      }
    },
    [],
  )

  return {
    proposals,
    loading: enabled && settledNonce !== nonce,
    error,
    updatingKey,
    refetch,
    setStatus,
  }
}
