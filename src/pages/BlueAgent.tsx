import { useMemo, useState } from 'react'

import { PageHeader } from '../components/layout/PageHeader'
import { ProposalCard } from '../components/domain/ProposalCard'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState } from '../components/ui/EmptyState'
import { Tabs } from '../components/ui/Tabs'
import { Skeleton } from '../components/ui/Skeleton'
import { useBlueProposals, proposalKey } from '../hooks/useBlueProposals'
import type { ProposalStatus } from '../lib/api/types'

type StatusFilter = 'all' | ProposalStatus

const TABS: { value: StatusFilter; label: string }[] = [
  { value: 'pending_approval', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

export default function BlueAgent() {
  const { proposals, loading, error, updatingKey, refetch, setStatus } = useBlueProposals()
  const [filter, setFilter] = useState<StatusFilter>('pending_approval')

  const counts = useMemo(
    () => ({
      pending_approval: proposals.filter((p) => p.status === 'pending_approval').length,
      approved: proposals.filter((p) => p.status === 'approved').length,
      rejected: proposals.filter((p) => p.status === 'rejected').length,
      all: proposals.length,
    }),
    [proposals],
  )

  const visible = useMemo(
    () => (filter === 'all' ? proposals : proposals.filter((p) => p.status === filter)),
    [proposals, filter],
  )

  // Decisions are serialised: while the API addresses proposals by array index, acting on two
  // at once (or during a refetch that may reorder them) risks updating the wrong one.
  const busy = updatingKey !== null || loading

  return (
    <>
      <PageHeader
        title="Blue Agent"
        description="Detection-gap analysis from the Blue Agent. Approving records a decision — it does not deploy anything."
        actions={
          <Button size="sm" onClick={refetch} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="space-y-4 p-5 lg:p-6">
        <div className="rounded border border-amber-line bg-amber-tint px-4 py-2.5">
          <p className="text-[12px] leading-relaxed text-amber">
            <strong className="font-semibold">Proposals are not deployed.</strong> Approving or
            rejecting a proposal records the decision against the research dataset only. No Wazuh
            rule is written, modified, or activated by this page.
          </p>
        </div>

        <Card flush>
          <Tabs<StatusFilter>
            ariaLabel="Filter proposals by status"
            value={filter}
            onChange={setFilter}
            items={TABS.map((tab) => ({ ...tab, count: counts[tab.value] }))}
          />
        </Card>

        {error && <ErrorState title="Could not update" message={error} onRetry={refetch} />}

        {loading && proposals.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-[280px] w-full rounded" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState
              title={
                counts.all === 0
                  ? 'No gaps found yet — run Blue Analysis to check current detection coverage'
                  : `No proposals with status “${filter.replace('_', ' ')}”`
              }
              detail={
                counts.all === 0
                  ? 'The Blue Agent inspects trials with low detection rates and proposes rule changes for anything it can improve. Run it from Live Operations.'
                  : 'Switch to another tab to see the rest of the queue.'
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            {visible.map((proposal) => {
              // The API updates by index, so the index must come from the *unfiltered* array.
              const index = proposals.indexOf(proposal)
              const key = proposalKey(proposal, index)
              return (
                <ProposalCard
                  key={key}
                  proposal={proposal}
                  index={index}
                  updating={updatingKey === key}
                  disabled={busy}
                  onDecide={(i, status, id) => void setStatus(i, status, id)}
                />
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
