import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { TrialField } from '../components/landing/TrialField'
import { useLogStream } from '../context/SocketContext'
import { useTrialsData } from '../hooks/useTrialsData'
import { buildField, escalation } from '../lib/landing/field'
import { formatCount, formatPct, formatSeconds } from '../lib/format'

/**
 * The landing page.
 *
 * One visual argument rather than a stack of sections: the attack scene plays continuously
 * behind the type, and scrolling moves through what it means — first the agent's escalating
 * delay drawing over the scene, then the detection rate drawing against it, then the field
 * reorganising so individual techniques can be inspected.
 *
 * Scroll does not touch React state. A single rAF loop writes opacity straight onto the type
 * nodes and hands the canvas its progress through a ref. Pushing a value through setState every
 * frame re-renders four blocks of type for a few pixels of movement, which is what made the
 * page feel heavy. React renders this page once.
 *
 * Deliberately dark where the app is light. This is the cover, not the instrument.
 */

const INK = '#E8ECF2'
const MUTED = '#8494A6'
const DIM = '#5A6878'
const ACCENT_RED = '#E06A54'
const ACCENT_TEAL = '#2DBEAF'

interface Band {
  from: number
  inEnd: number
  outStart: number
  to: number
  /** The opening block is on screen at load, so it only ever fades out. */
  startsVisible?: boolean
}

/*
 * Pacing.
 *
 * Progress is scroll position across DRIVER_VH minus one viewport, so a band's fraction is a
 * fraction of the *scrollable* distance, not of the raw height. The original numbers spent the
 * first 0.30 on the hero alone, which meant nearly a full screen of scrolling before the second
 * section began to appear — the page read as stuck rather than as a narrative. These bands hand
 * roughly equal scroll to each of the four sections and leave almost no dead gap between them.
 */
const DRIVER_VH = 300

const BANDS: Record<string, Band> = {
  hero: { from: -1, inEnd: 0, outStart: 0.08, to: 0.18, startsVisible: true },
  escalation: { from: 0.2, inEnd: 0.28, outStart: 0.42, to: 0.5 },
  payoff: { from: 0.52, inEnd: 0.6, outStart: 0.74, to: 0.82 },
  // outStart sits past 1 so the final section never fades — it is the resting state.
  explore: { from: 0.84, inEnd: 0.92, outStart: 1.1, to: 1.2 },
}

/** Smoothstep in and out across a band. */
function opacityFor(progress: number, b: Band): number {
  if (progress <= b.from || progress >= b.to) return 0
  if (progress < b.inEnd) {
    if (b.startsVisible) return 1
    const t = (progress - b.from) / (b.inEnd - b.from)
    return t * t * (3 - 2 * t)
  }
  if (progress > b.outStart) {
    const t = 1 - (progress - b.outStart) / (b.to - b.outStart)
    return t * t * (3 - 2 * t)
  }
  return 1
}

/**
 * Drives the narrative without re-rendering.
 *
 * Returns a ref holding continuous progress for the canvas, and styles the type nodes in place.
 */
function useNarrative(
  driverRef: React.RefObject<HTMLDivElement | null>,
  blockRefs: Record<string, React.RefObject<HTMLElement | null>>,
) {
  const progressRef = useRef(0)

  useEffect(() => {
    let frame = 0
    // offsetTop / offsetHeight force layout. Read once and on resize, never per frame.
    let top = 0
    let span = 1

    const measure = () => {
      const el = driverRef.current
      if (!el) return
      top = el.offsetTop
      span = Math.max(1, el.offsetHeight - window.innerHeight)
    }

    const paint = () => {
      frame = 0
      const p = Math.max(0, Math.min(1, (window.scrollY - top) / span))
      progressRef.current = p

      const nodes = blockRefs
      if (nodes) {
        for (const key of Object.keys(BANDS)) {
          const el = nodes[key]?.current
          if (!el) continue
          const o = opacityFor(p, BANDS[key])
          el.style.opacity = `${o}`
          el.style.transform = `translate3d(0, ${((1 - o) * 16).toFixed(2)}px, 0)`
          el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
          el.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
        }
      }
    }

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(paint)
    }
    const onResize = () => {
      measure()
      onScroll()
    }

    measure()
    paint()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [driverRef, blockRefs])

  return progressRef
}

export default function Landing() {
  const { trials, loading, error, refetch } = useTrialsData('agentic')
  const socket = useLogStream()
  const [isolate, setIsolate] = useState<string | null>(null)

  const driverRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const escalationRef = useRef<HTMLElement>(null)
  const payoffRef = useRef<HTMLElement>(null)
  const exploreRef = useRef<HTMLElement>(null)

  // Stable identity so the narrative loop's effect never re-subscribes.
  const plates = useMemo(
    () => ({ hero: heroRef, escalation: escalationRef, payoff: payoffRef, explore: exploreRef }),
    [],
  )
  const progressRef = useNarrative(driverRef, plates)

  // When a batch is mid-run the scene stops replaying history and accumulates real events.
  const live = socket.status === 'open' && socket.lastBatchStep === 'BATCH_START'

  const model = useMemo(() => buildField(trials), [trials])

  const stats = useMemo(
    () => ({
      total: model.total,
      rate: model.total ? model.detected / model.total : 0,
    }),
    [model],
  )

  const escalationStats = useMemo(
    () => (model.total >= 40 ? escalation(model, 40) : null),
    [model],
  )

  // The campaign needs enough trials before a trend means anything. Below that the plates
  // state the gap rather than asserting a result the data cannot support.
  const hasTrend = model.total >= 40

  const delayFactor =
    escalationStats && escalationStats.delayFrom
      ? escalationStats.delayTo! / escalationStats.delayFrom
      : null


  return (
    <div className="landing" style={{ background: '#05080D' }}>
      <div className="fixed inset-0 z-0">
        <TrialField
          trials={trials}
          progressRef={progressRef}
          isolate={isolate}
          live={live}
        />
      </div>

      {/* Scroll driver: provides the height, draws nothing. */}
      <div
        ref={driverRef}
        className="pointer-events-none relative z-10"
        style={{ height: `${DRIVER_VH}vh` }}
      />

      {/* Type layer. */}
      <div className="pointer-events-none fixed inset-0 z-20">
        {/* z-30 keeps this above the plates. They are absolute inset-0 and switch pointer-events
            on when visible, so without a higher stacking order they swallow the link's clicks. */}
        <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 lg:px-10">
          <span
            className="text-[12px] font-medium tracking-[0.16em] uppercase"
            style={{ color: MUTED }}
          >
            Threat Emulation
          </span>
          <Link
            to="/overview"
            className="pointer-events-auto text-[12px] font-medium transition-opacity hover:opacity-70"
            style={{ color: INK }}
          >
            Dashboard →
          </Link>
        </header>

        {error && (
          <div className="absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-3 px-6 text-center">
            <p className="text-[14px]" style={{ color: INK }}>
              The backend is unreachable — there is nothing to draw.
            </p>
            <p className="max-w-[46ch] text-[12.5px] leading-relaxed" style={{ color: MUTED }}>
              This scene is built from live trial data. Start the API on the lab VM, then retry.
            </p>
            <button
              type="button"
              onClick={refetch}
              className="pointer-events-auto mt-1 rounded border px-4 py-2 text-[12px] font-medium"
              style={{ borderColor: '#26313D', color: INK }}
            >
              Try again
            </button>
          </div>
        )}

        {/* ---- hero ---- */}
        <Plate ref={heroRef} className="justify-end pb-[14vh]">
          <p
            className="mb-5 text-[11px] font-medium tracking-[0.22em] uppercase"
            style={{ color: ACCENT_TEAL }}
          >
            Autonomous red / blue agent research
          </p>

          <h1
            className="max-w-[15ch] text-[clamp(2.4rem,6.4vw,5.4rem)] leading-[0.94] font-semibold tracking-[-0.035em]"
            style={{ color: INK }}
          >
            Two agents. One loop. No script.
          </h1>

          <p className="mt-6 max-w-[50ch] text-[14.5px] leading-relaxed" style={{ color: MUTED }}>
            An AI red agent attacks a live Windows target through Caldera. Wazuh watches. When
            detection holds, the agent waits longer and tries again.{' '}
            <span style={{ color: INK }}>
              Each streak below is one real trial — teal ones the shield stops, orange ones that
              got through and scarred the target.
            </span>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]" style={{ color: DIM }}>
            <span className="font-mono">{loading ? '—' : formatCount(stats.total)} trials</span>
            <span style={{ color: '#2A3442' }}>/</span>
            <span className="font-mono">
              {loading ? '—' : formatCount(model.techniques.length)} techniques
            </span>
            <span style={{ color: '#2A3442' }}>/</span>
            <span className="font-mono">
              {loading ? '—' : formatPct(stats.rate)} detected
            </span>
          </div>

          <p className="mt-9 flex items-center gap-3 text-[11px]" style={{ color: DIM }}>
            <span className="inline-block h-7 w-px" style={{ background: '#25303D' }} />
            Scroll
          </p>
        </Plate>

        {/* ---- the escalation ---- */}
        <Plate ref={escalationRef} className="justify-center">
          <p
            className="mb-4 text-[11px] font-medium tracking-[0.22em] uppercase"
            style={{ color: ACCENT_RED }}
          >
            What the agent learned
          </p>
          <h2
            className="max-w-[18ch] text-[clamp(1.7rem,3.6vw,2.9rem)] leading-[1.02] font-semibold tracking-[-0.03em]"
            style={{ color: INK }}
          >
            {hasTrend ? 'It learned to wait.' : 'Not enough trials yet.'}
          </h2>

            <p className="text-[13.5px] leading-relaxed" style={{ color: MUTED }}>
              Only {formatCount(model.total)} trials recorded so far. A trend needs a few hundred —
              run more batches and this fills in.
            </p>

          {hasTrend && escalationStats && (
            <div className="mt-7 flex items-end gap-4">
              <span
                className="font-mono text-[clamp(1.4rem,3vw,2.3rem)] leading-none"
                style={{ color: MUTED }}
              >
                {formatSeconds(escalationStats.delayFrom, 1)}
              </span>
              <span className="pb-1 text-[19px]" style={{ color: '#2A3442' }}>
                →
              </span>
              <span
                className="font-mono text-[clamp(2.4rem,5.4vw,4.2rem)] leading-none font-medium"
                style={{ color: ACCENT_RED }}
              >
                {formatSeconds(escalationStats.delayTo, 1)}
              </span>
            </div>
          )}

          {hasTrend && (
          <p className="mt-5 max-w-[46ch] text-[13.5px] leading-relaxed" style={{ color: MUTED }}>
            Mean injected delay, first forty trials against the last forty. The red agent stretched
            its evasion timing almost eightfold.
          </p>
          )}
        </Plate>

        {/* ---- the payoff ---- */}
        <Plate ref={payoffRef} className="justify-center">
          <p
            className="mb-4 text-[11px] font-medium tracking-[0.22em] uppercase"
            style={{ color: ACCENT_TEAL }}
          >
            What it bought
          </p>
          <h2
            className="max-w-[20ch] text-[clamp(1.7rem,3.6vw,2.9rem)] leading-[1.02] font-semibold tracking-[-0.03em]"
            style={{ color: INK }}
          >
            {hasTrend ? 'Detection ended where it started.' : 'Nothing to compare yet.'}
          </h2>

            <p className="text-[13.5px] leading-relaxed" style={{ color: MUTED }}>
              Only {formatCount(model.total)} trials recorded so far. A trend needs a few hundred —
              run more batches and this fills in.
            </p>

          {hasTrend && escalationStats && (
            <div className="mt-7 flex items-end gap-4">
              <span
                className="font-mono text-[clamp(1.4rem,3vw,2.3rem)] leading-none"
                style={{ color: MUTED }}
              >
                {formatPct(escalationStats.rateFrom, 1)}
              </span>
              <span className="pb-1 text-[19px]" style={{ color: '#2A3442' }}>
                →
              </span>
              <span
                className="font-mono text-[clamp(2.4rem,5.4vw,4.2rem)] leading-none font-medium"
                style={{ color: ACCENT_TEAL }}
              >
                {formatPct(escalationStats.rateTo, 1)}
              </span>
            </div>
          )}

          {hasTrend && (
          <p className="mt-5 max-w-[48ch] text-[13.5px] leading-relaxed" style={{ color: MUTED }}>
            {delayFactor ? `${delayFactor.toFixed(1)}× the delay. No net change in detection. ` : ''}
            The adaptation the prior work named as its own future work was built — and on this
            evidence it did not pay for itself.
          </p>
          )}
        </Plate>

        {/* ---- explore ---- */}
        <Plate ref={exploreRef} className="justify-center">
          <h2
            className="max-w-[20ch] text-[clamp(1.4rem,3vw,2.2rem)] leading-[1.05] font-semibold tracking-[-0.03em]"
            style={{ color: INK }}
          >
            Read it yourself.
          </h2>

          <p className="mt-4 max-w-[46ch] text-[13.5px] leading-relaxed" style={{ color: MUTED }}>
            Select a technique to isolate it across the whole campaign.
          </p>

          <ul className="mt-6 flex max-w-[660px] flex-wrap gap-2">
            {model.techniques.map((technique) => {
              const active = isolate === technique.key
              return (
                <li key={technique.key}>
                  <button
                    type="button"
                    onClick={() => setIsolate(active ? null : technique.key)}
                    className="flex items-center gap-2 rounded border px-3 py-1.5 text-[12px] transition-colors"
                    style={{
                      borderColor: active ? ACCENT_TEAL : '#1E2833',
                      background: active ? 'rgba(45,190,175,0.1)' : 'transparent',
                      color: active ? INK : MUTED,
                    }}
                  >
                    <span className="font-mono text-[11px]" style={{ color: DIM }}>
                      {technique.mitreId}
                    </span>
                    <span>{technique.label}</span>
                    <span className="font-mono text-[11px]" style={{ color: DIM }}>
                      {technique.count}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/overview"
              className="rounded px-5 py-2.5 text-[13px] font-medium transition-opacity hover:opacity-85"
              style={{ background: ACCENT_TEAL, color: '#04211E' }}
            >
              Open the dashboard
            </Link>
            <Link
              to="/methodology"
              className="rounded border px-5 py-2.5 text-[13px] font-medium transition-colors"
              style={{ borderColor: '#26313D', color: INK }}
            >
              Read the methodology
            </Link>
          </div>
        </Plate>
      </div>
    </div>
  )
}

interface PlateProps {
  className?: string
  children: React.ReactNode
}

/**
 * A full-viewport type plate.
 *
 * Opacity is written by the narrative loop, not by props — so this component never re-renders
 * during scroll. It starts hidden and is revealed by the first paint.
 */
const Plate = forwardRef<HTMLElement, PlateProps>(function Plate({ className = '', children }, ref) {
  return (
    <section
      ref={ref}
      className={`absolute inset-0 flex flex-col px-6 lg:px-16 ${className}`}
      style={{ opacity: 0, visibility: 'hidden', willChange: 'opacity, transform' }}
    >
      <div className="w-full max-w-[64rem]">{children}</div>
    </section>
  )
})
