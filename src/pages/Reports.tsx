import { useEffect, useRef, useState } from 'react'

import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { chartUrl, type ChartName } from '../lib/api'

const FIGURES: { name: ChartName; title: string; caption: string; source: string }[] = [
  {
    name: 'tpr-comparison',
    title: 'Detection rate by technique',
    caption:
      'Static baseline against the agentic red agent, per technique. The primary outcome measure.',
    source: 'GET /api/charts/tpr-comparison',
  },
  {
    name: 'mttd-cdf',
    title: 'Time-to-detect distribution',
    caption:
      'Empirical CDF of time to first alert. Curves further left indicate faster detection.',
    source: 'GET /api/charts/mttd-cdf',
  },
  {
    name: 'eps-by-technique',
    title: 'Evasion persistence by technique',
    caption:
      'Early-versus-late detection change per technique. Positive values indicate evasion that persisted.',
    source: 'GET /api/charts/eps-by-technique',
  },
]

export default function Reports() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Publication-quality figures rendered server-side from the current data. These are the static figures for the written report, distinct from the interactive charts elsewhere."
      />

      <div className="space-y-10 px-6 pb-12 lg:px-8">
        {FIGURES.map((figure) => (
          <FigureSlot key={figure.name} {...figure} />
        ))}

        <p className="t-secondary max-w-3xl text-ink-faint">
          These figures are rendered by the Python pipeline rather than the browser, so they match
          the written report exactly. Each request regenerates from the current data. Use
          Regenerate to re-fetch after a batch, or Download PNG to save the figure for the paper.
        </p>
      </div>
    </>
  )
}

type LoadState = 'loading' | 'ready' | 'missing'

interface FigureSlotProps {
  name: ChartName
  title: string
  caption: string
  source: string
}

function FigureSlot({ name, title, caption, source }: FigureSlotProps) {
  // Bumping `bust` produces a new src, and the keyed child remounts into a fresh loading
  // state — which is what makes Regenerate show a skeleton instead of a frozen old image.
  const [bust, setBust] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const src = chartUrl(name, bust ?? undefined)

  /**
   * Fetch-then-save rather than a plain `download` attribute on a cross-origin link: browsers
   * ignore `download` across origins, so that approach would just open the image in a tab.
   * Pulling the bytes and handing the browser a same-origin object URL makes the save real.
   */
  const download = async () => {
    setDownloading(true)
    try {
      const response = await fetch(src)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `${name}.png`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(objectUrl)
    } catch {
      // No figure to save, or CORS refused it — show the user the URL rather than nothing.
      window.open(src, '_blank', 'noreferrer')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card
      title={title}
      subtitle={caption}
      actions={
        <>
          <span className="hidden font-mono text-[10.5px] text-ink-faint lg:inline">{source}</span>
          <Button size="sm" onClick={() => setBust(Date.now())}>
            Regenerate
          </Button>
          <Button size="sm" loading={downloading} onClick={() => void download()}>
            Download PNG
          </Button>
        </>
      }
    >
      <FigureImage key={bust ?? 'initial'} src={src} alt={title} endpoint={source} />
    </Card>
  )
}

function FigureImage({ src, alt, endpoint }: { src: string; alt: string; endpoint: string }) {
  const [state, setState] = useState<LoadState>('loading')
  const imgRef = useRef<HTMLImageElement>(null)

  /*
   * The image is deliberately never `display: none`. Hiding it deadlocks: the browser defers
   * loading for hidden images, so `onLoad` never fires, so it never becomes visible — which is
   * exactly the failure this slot used to have. It stays in flow and an overlay covers it.
   *
   * The `complete` check covers the opposite race: a cached image finishes before React
   * attaches the listener, so `onLoad` is missed and the slot would sit on a skeleton.
   */
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete) {
      setState(img.naturalWidth > 0 ? 'ready' : 'missing')
    }
  }, [src])

  return (
    <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={() => setState('ready')}
        onError={() => setState('missing')}
        className="w-full"
      />

      {state === 'loading' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6"
          aria-busy="true"
          aria-label={`Loading ${alt}`}
        >
          <Skeleton className="h-[220px] w-full" />
          <p className="t-secondary text-ink-faint">Rendering figure…</p>
        </div>
      )}

      {state === 'missing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <Badge tone="neutral" dot>
            Chart not yet available
          </Badge>
          <p className="t-card text-ink">Figure could not be loaded</p>
          <p className="t-secondary max-w-md text-ink-muted">
            <code className="t-technical text-ink-muted">{endpoint}</code> did not return an image.
            Check that the route exists and that matplotlib can render from the current data.
          </p>
        </div>
      )}
    </div>
  )
}

