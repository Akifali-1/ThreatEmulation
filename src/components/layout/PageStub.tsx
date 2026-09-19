import type { ReactNode } from 'react'

import { PageHeader } from '../layout/PageHeader'
import { Card } from '../ui/Card'

interface PageStubProps {
  title: string
  description: string
  /** Which build step delivers the real implementation. */
  step: number
  /** What the finished page will contain. */
  willShow: ReactNode
}

/**
 * Placeholder for a page whose implementation lands in a later step. It states plainly that
 * it is unbuilt rather than rendering sample data — nothing in this app shows invented values.
 */
export function PageStub({ title, description, step, willShow }: PageStubProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="p-5 lg:p-6">
        <Card title={`Not built yet — step ${step}`}>
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            This page is scaffolded and routed, but its content is not implemented yet. When
            complete it will show:
          </p>
          <ul className="mt-2.5 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-ink-muted">
            {willShow}
          </ul>
        </Card>
      </div>
    </>
  )
}
