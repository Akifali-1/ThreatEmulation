import { formatPct } from '../../lib/format'
import { splitProposal } from '../../lib/proposal'
import type { BlueProposal, ProposalStatus } from '../../lib/api/types'
import { Badge, type BadgeTone } from '../ui/Badge'
import { Button } from '../ui/Button'
import { MarkdownLite } from '../ui/MarkdownLite'
import { RuleXml } from './RuleXml'
import { TechniqueLabel } from './TechniqueLabel'

const STATUS_META: Record<ProposalStatus, { label: string; tone: BadgeTone }> = {
  pending_approval: { label: 'Pending approval', tone: 'pending' },
  approved: { label: 'Approved', tone: 'detected' },
  rejected: { label: 'Rejected', tone: 'miss' },
}

interface ProposalCardProps {
  proposal: BlueProposal
  index: number
  updating: boolean
  /** True when another proposal is mid-update — decisions are serialised. */
  disabled: boolean
  onDecide: (index: number, status: ProposalStatus, id?: string | null) => void
}

export function ProposalCard({
  proposal,
  index,
  updating,
  disabled,
  onDecide,
}: ProposalCardProps) {
  const status = STATUS_META[proposal.status] ?? STATUS_META.pending_approval
  const pending = proposal.status === 'pending_approval'
  const segments = splitProposal(proposal.proposal)
  // Prefer the stable id once the backend provides one; fall back to the array index.
  const decide = (next: ProposalStatus) => onDecide(index, next, proposal.id)

  return (
    <article className="flex min-w-0 flex-col rounded border border-border bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <TechniqueLabel technique={proposal.technique} />
          <p className="mt-1 flex items-baseline gap-1.5 text-[11px]">
            <span className="uppercase tracking-wide text-ink-faint">Detection rate</span>
            <span className="tnum font-mono text-ink">{formatPct(proposal.detection_rate, 0)}</span>
            <span className="text-ink-faint">under current coverage</span>
          </p>
        </div>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </header>

      <div className="scroll-thin max-h-[420px] space-y-3 overflow-y-auto px-4 py-3.5">
        {segments.map((segment, i) =>
          segment.kind === 'xml' ? (
            <RuleXml key={i} xml={segment.content} />
          ) : (
            <MarkdownLite key={i} text={segment.content} />
          ),
        )}
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-border bg-surface-2 px-4 py-2.5">
        {pending ? (
          <>
            <Button
              size="sm"
              variant="approve"
              loading={updating}
              disabled={disabled}
              onClick={() => decide('approved')}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="reject"
              disabled={disabled || updating}
              onClick={() => decide('rejected')}
            >
              Reject
            </Button>
            <span className="ml-auto text-[10.5px] text-ink-faint">
              Recorded only — no rule is deployed
            </span>
          </>
        ) : (
          <span className="text-[11px] text-ink-muted">
            {proposal.status === 'approved'
              ? 'Approved — marked for inclusion in the detection rule set.'
              : 'Rejected — no rule change applied.'}
          </span>
        )}
      </footer>
    </article>
  )
}
