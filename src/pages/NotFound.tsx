import { Link } from 'react-router'

import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'

export default function NotFound() {
  return (
    <>
      <PageHeader title="Not found" description="That route does not exist in this dashboard." />
      <EmptyState
        title="No such page"
        detail="The link may be stale, or the URL mistyped."
        action={
          <Link
            to="/"
            className="rounded border border-border-strong bg-surface px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-2"
          >
            Back to overview
          </Link>
        }
      />
    </>
  )
}
