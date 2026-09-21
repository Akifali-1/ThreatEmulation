import { useEffect, useMemo, useRef } from 'react'

import { buildField, frontier, rollingSeries } from '../../lib/landing/field'
import type { Trial } from '../../lib/api/types'

/**
 * The attack, made literal.
 *
 * A target sits on the right behind a detection shield. Every recorded trial launches as a
 * streak from the left. If Wazuh caught it, the streak slams into the shield, splashes and
 * dies. If it evaded, the streak passes clean through and **strikes the target**, leaving a
 * permanent scar.
 *
 * The point is that none of this needs explaining. Attacks come in, some are stopped, some
 * land, and the target visibly degrades as the feed plays. The scar count at the end is the
 * evasion count — read off the picture, not a caption.
 *
 * What is real data and nothing else:
 *   - whether a streak is stopped or lands = that trial's detection outcome
 *   - how long the streak takes to arrive  = that trial's injected delay
 *   - which track it flies along          = that trial's technique
 */

const BG = '#05080D'
const DETECTED = { r: 45, g: 190, b: 175 }
const EVADED = { r: 224, g: 106, b: 84 }
const SHIELD = { r: 140, g: 176, b: 205 }
const TARGET = { r: 220, g: 228, b: 238 }

const rgba = (c: { r: number; g: number; b: number }, a: number) =>
  `rgba(${c.r},${c.g},${c.b},${a})`

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Playback timing, in ms. Short on purpose: a security feed should feel busy, and a slow
 * replay gives the eye time to read the marks as decoration rather than as events.
 */
const SPAN = 3_600 // attacks distributed across this window
const FLIGHT_BASE = 220 // travel time for the fastest attack
const FLIGHT_DELAY = 380 // extra travel at the maximum observed delay
const HOLD = 800 // the finished scene rests before replaying

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  colour: { r: number; g: number; b: number }
}

interface TrialFieldProps {
  trials: Trial[]
  /**
   * Continuous scroll progress, held in a ref rather than a prop so the narrative loop can
   * drive the curves without re-rendering this component on every scroll frame.
   */
  progressRef: React.RefObject<number>
  isolate: string | null
  live?: boolean
}

export function TrialField({ trials, progressRef, isolate, live = false }: TrialFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const props = useRef({ isolate, live })
  useEffect(() => {
    props.current = { isolate, live }
  }, [isolate, live])

  const model = useMemo(() => buildField(trials), [trials])
  const series = useMemo(() => rollingSeries(model), [model])
  const frontierPoints = useMemo(() => frontier(model), [model])

  const data = useRef({ model, series, frontierPoints })
  useEffect(() => {
    data.current = { model, series, frontierPoints }
  }, [model, series, frontierPoints])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let raf = 0
    let running = true
    let clock = 0
    let last = performance.now()

    let sparks: Spark[] = []
    let lands: { ty: number; at: number }[] = []
    let shieldFlash = 0
    let targetFlash = 0
    let lastArrived = -1

    const cursor = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: 0, targetActive: 0 }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = wrap.clientWidth
      height = wrap.clientHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    const onMove = (event: PointerEvent) => {
      const rect = wrap.getBoundingClientRect()
      cursor.tx = (event.clientX - rect.left) / rect.width
      cursor.ty = (event.clientY - rect.top) / rect.height
      cursor.targetActive = 1
    }
    const onLeave = () => {
      cursor.targetActive = 0
    }
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)

    const PAD_TOP = 0.16
    const PAD_BOTTOM = 0.14
    const SHIELD_X = 0.62
    const TARGET_X = 0.86
    const TARGET_W = 0.055
    const CURVE_SCALE = 0.86
    /**
     * Below this many trials a rolling window has no trend in it, so the curves would render as
     * a flat line — which reads as "detection never changed" when the truth is "there is not
     * enough data to say". Better to draw nothing.
     */
    const MIN_TRIALS_FOR_TREND = 40

    const draw = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now

      const { isolate: iso, live: isLive } = props.current

      // Read the live scroll position straight off the ref — no prop, no render.
      const p = progressRef.current ?? 0
      const sortT = Math.max(0, Math.min(1, (p - 0.86) / 0.12))
      const { model: m, series: s, frontierPoints: fp } = data.current
      const total = m.strands.length

      if (isLive) {
        clock = SPAN + FLIGHT_BASE + FLIGHT_DELAY
      } else {
        clock += dt
        if (clock > SPAN + HOLD) clock = 0
      }

      cursor.x += (cursor.tx - cursor.x) * 0.12
      cursor.y += (cursor.ty - cursor.y) * 0.12
      cursor.active += (cursor.targetActive - cursor.active) * 0.1

      ctx.fillStyle = BG
      ctx.fillRect(0, 0, width, height)

      if (total === 0) {
        raf = requestAnimationFrame(draw)
        return
      }

      const top = height * PAD_TOP
      const bottom = height * (1 - PAD_BOTTOM)
      const bandH = bottom - top
      const laneCount = Math.max(1, m.techniques.length)
      const shieldX = width * SHIELD_X
      const targetL = width * TARGET_X
      const targetR = targetL + width * TARGET_W
      const targetMid = (targetL + targetR) / 2
      const maxDelay = m.maxDelay || 1

      // ---- advance playback -------------------------------------------------

      let arrived = 0
      for (let i = 0; i < total; i += 1) {
        const strand = m.strands[i]
        const launchAt = (i / Math.max(1, total - 1)) * SPAN
        const flight = FLIGHT_BASE + ((strand.delay ?? 0) / maxDelay) * FLIGHT_DELAY
        if (clock >= launchAt + flight) arrived = i + 1
      }

      if (arrived > lastArrived) {
        for (let i = Math.max(0, lastArrived + 1); i < arrived; i += 1) {
          const strand = m.strands[i]
          const ty = (strand.lane + 0.5) / laneCount
          const y = top + ty * bandH

          if (strand.detected) {
            // Stopped at the shield. Splash back toward the attacker.
            shieldFlash = Math.min(1, shieldFlash + 0.45)
            for (let k = 0; k < 8; k += 1) {
              const a = (Math.random() - 0.5) * 1.5
              sparks.push({
                x: shieldX - 2,
                y,
                vx: -Math.abs(Math.cos(a)) * (0.5 + Math.random() * 1.5),
                vy: Math.sin(a) * (0.7 + Math.random() * 1.8),
                life: 1,
                colour: DETECTED,
              })
            }
          } else {
            // Through the shield and into the target. Permanent scar.
            targetFlash = Math.min(1, targetFlash + 0.6)
            lands.push({ ty, at: now })
            for (let k = 0; k < 10; k += 1) {
              const a = Math.random() * Math.PI * 2
              sparks.push({
                x: targetL + Math.random() * (targetR - targetL),
                y,
                vx: Math.cos(a) * (0.6 + Math.random() * 1.6),
                vy: Math.sin(a) * (0.6 + Math.random() * 1.6),
                life: 1,
                colour: EVADED,
              })
            }
          }
        }
        lastArrived = arrived
      }

      shieldFlash = Math.max(0, shieldFlash - dt * 0.003)
      targetFlash = Math.max(0, targetFlash - dt * 0.0026)

      // Scrim: the type sits on the left, so the field is dimmed there. Drawn over the marks
      // but under the curves, so the data on the right stays at full strength.
      const scrim = ctx.createLinearGradient(0, 0, width * 0.58, 0)
      scrim.addColorStop(0, 'rgba(5,8,13,0.9)')
      scrim.addColorStop(0.6, 'rgba(5,8,13,0.5)')
      scrim.addColorStop(1, 'rgba(5,8,13,0)')
      ctx.fillStyle = scrim
      ctx.fillRect(0, 0, width * 0.58, height)

      // ---- the shield -------------------------------------------------------

      const time = now * 0.001
      const shieldRows = 88
      for (let row = 0; row < shieldRows; row += 1) {
        const ty = row / (shieldRows - 1)
        const y = top + ty * bandH
        const lane = Math.min(laneCount - 1, Math.floor(ty * laneCount))
        const focused = iso === null || m.techniques[lane]?.key === iso

        const wave = Math.sin(ty * 9 + time * 1.1) * 1.4
        const lens = Math.max(0, 1 - Math.abs(y / height - cursor.y) * 9) * cursor.active
        const a = Math.min(1, (focused ? 0.16 : 0.035) + shieldFlash * 0.4 + lens * 0.35)
        if (a < 0.02) continue

        ctx.strokeStyle = rgba(SHIELD, a)
        ctx.lineWidth = 1
        for (let col = 0; col < 7; col += 1) {
          const cx = shieldX - 9 + col * 3 + wave
          ctx.beginPath()
          ctx.moveTo(cx, y)
          ctx.lineTo(cx + 2.2, y)
          ctx.stroke()
        }
      }

      // ---- the target, and its damage ---------------------------------------

      const targetFill = 0.06 + targetFlash * 0.25
      ctx.fillStyle = rgba(TARGET, targetFill)
      ctx.strokeStyle = rgba(TARGET, 0.28 + targetFlash * 0.4)
      ctx.lineWidth = 1.2
      roundRect(ctx, targetL, top - 14, targetR - targetL, bandH + 28, 6)
      ctx.fill()
      ctx.stroke()

      // Scars: every evaded trial leaves a permanent mark. This is the evasion count, drawn.
      for (const land of lands) {
        const y = top + land.ty * bandH
        const age = Math.min(1, (now - land.at) / 400)
        const seed = Math.abs(Math.sin(land.ty * 137.5))
        const sx = targetL + 6 + seed * (targetR - targetL - 12)
        ctx.beginPath()
        ctx.fillStyle = rgba(EVADED, 0.25 + age * 0.45)
        ctx.arc(sx, y, 1.5 + age * 1.6, 0, Math.PI * 2)
        ctx.fill()
      }

      // ---- attacks in flight ------------------------------------------------

      for (let i = 0; i < total; i += 1) {
        const strand = m.strands[i]
        const launchAt = (i / Math.max(1, total - 1)) * SPAN
        const flight = FLIGHT_BASE + ((strand.delay ?? 0) / maxDelay) * FLIGHT_DELAY
        const t = (clock - launchAt) / flight
        if (t < 0 || t > 1) continue

        const ty = (strand.lane + 0.5) / laneCount
        const y = top + ty * bandH
        const lane = Math.min(laneCount - 1, Math.floor(ty * laneCount))
        const focused = iso === null || m.techniques[lane]?.key === iso

        const endX = strand.detected ? shieldX : targetMid
        const startX = -50
        const x = startX + (endX - startX) * t

        const colour = strand.detected ? DETECTED : EVADED
        const head = easeOut(t)
        const alpha = (focused ? 0.95 : 0.15) * (0.35 + head * 0.65)

        // Comet: the tail lengthens as it accelerates toward impact.
        const tail = 22 + head * 96
        const grad = ctx.createLinearGradient(x - tail, y, x, y)
        grad.addColorStop(0, rgba(colour, 0))
        grad.addColorStop(1, rgba(colour, alpha))
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x - tail, y)
        ctx.lineTo(x, y)
        ctx.stroke()

        ctx.beginPath()
        ctx.fillStyle = rgba(colour, Math.min(1, alpha * 1.35))
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      }

      // ---- sparks -----------------------------------------------------------

      sparks = sparks.filter((sp) => sp.life > 0)
      for (const sp of sparks) {
        sp.x += sp.vx * dt * 0.07
        sp.y += sp.vy * dt * 0.07
        sp.vy += dt * 0.005
        sp.life -= dt * 0.0018
        if (sp.life <= 0) continue
        ctx.beginPath()
        ctx.fillStyle = rgba(sp.colour, sp.life * 0.85)
        ctx.arc(sp.x, sp.y, 1 + sp.life * 1.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // ---- live tallies, read off the scene ---------------------------------

      const blocked = lastArrived > 0 ? m.strands.slice(0, lastArrived).filter((x) => x.detected).length : 0
      const through = Math.max(0, lastArrived - blocked)

      ctx.font = '500 12px "IBM Plex Mono", ui-monospace, monospace'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = rgba(DETECTED, 0.85)
      ctx.fillText(`${blocked} blocked`, shieldX - 96, top - 34)
      ctx.fillStyle = rgba(EVADED, 0.9)
      ctx.fillText(`${through} through`, targetL - 8, top - 34)

      // ---- scroll-driven curves ---------------------------------------------

      if (s.length > 1 && total >= MIN_TRIALS_FOR_TREND && p > 0.3) {
        const curveT = Math.min(1, (p - 0.3) / 0.3)
        const path: [number, number][] = []
        for (const point of s) {
          if (point.delay === null) continue
          path.push([
            width * 0.045 + point.t * width * 0.91,
            bottom - (point.delay / maxDelay) * bandH * CURVE_SCALE,
          ])
        }
        if (path.length > 1) {
          const upto = Math.max(2, Math.floor(path.length * easeOut(curveT)))
          ctx.save()
          ctx.beginPath()
          ctx.strokeStyle = rgba(EVADED, 0.8)
          ctx.lineWidth = 2
          ctx.shadowColor = rgba(EVADED, 0.5)
          ctx.shadowBlur = 12
          ctx.moveTo(path[0][0], path[0][1])
          for (let i = 1; i < upto; i += 1) ctx.lineTo(path[i][0], path[i][1])
          ctx.stroke()
          ctx.restore()
        }
      }

      if (s.length > 1 && total >= MIN_TRIALS_FOR_TREND && p > 0.62) {
        const curveT = Math.min(1, (p - 0.62) / 0.28)
        const upto = Math.max(2, Math.floor(s.length * easeOut(curveT)))
        ctx.save()
        ctx.beginPath()
        ctx.strokeStyle = rgba(DETECTED, 0.9)
        ctx.lineWidth = 2
        ctx.shadowColor = rgba(DETECTED, 0.45)
        ctx.shadowBlur = 12
        for (let i = 0; i < upto; i += 1) {
          const point = s[i]
          const x = width * 0.045 + point.t * width * 0.91
          const y = bottom - point.rate * bandH * CURVE_SCALE
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }

      if (total >= MIN_TRIALS_FOR_TREND && sortT > 0.5) {
        const fade = (sortT - 0.5) / 0.5
        for (const point of fp) {
          if (point.rate === null) continue
          ctx.beginPath()
          ctx.fillStyle = rgba(DETECTED, 0.3 * fade)
          ctx.arc(
            width * 0.045 + (point.delay / maxDelay) * width * 0.91,
            bottom - point.rate * bandH * CURVE_SCALE,
            2.5,
            0,
            Math.PI * 2,
          )
          ctx.fill()
        }
      }


      if (running) raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      observer.disconnect()
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
    }
  }, [progressRef])

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
