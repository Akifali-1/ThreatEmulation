import { expect, test, type Page } from '@playwright/test'

/**
 * Drives the Live Operations page from a scripted frame sequence.
 *
 * The real stream needs the lab VM, so window.WebSocket is replaced before any app code runs and
 * the test feeds frames in by hand. That makes the timing behaviour — the WAITING countdown,
 * which the backend deliberately does not send per-second updates for — actually testable, and
 * lets out-of-order frames be constructed on purpose.
 */

declare global {
  interface Window {
    __sockets: { deliver: (frame: unknown) => void }[]
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class MockSocket {
      url: string
      readyState = 0
      onopen: ((event: unknown) => void) | null = null
      onmessage: ((event: { data: string }) => void) | null = null
      onerror: ((event: unknown) => void) | null = null
      onclose: ((event: unknown) => void) | null = null

      constructor(url: string) {
        this.url = url
        window.__sockets = window.__sockets ?? []
        window.__sockets.push(this)
        setTimeout(() => {
          this.readyState = 1
          this.onopen?.({})
        }, 0)
      }

      send() {}
      close() {
        this.readyState = 3
        this.onclose?.({})
      }
      deliver(frame: unknown) {
        this.onmessage?.({ data: JSON.stringify(frame) })
      }
    }
    // @ts-expect-error — a stand-in good enough for the app's usage, not a full implementation.
    window.WebSocket = MockSocket
    window.__sockets = []
  })

  await page.goto('/live')
  await page.waitForFunction(() => window.__sockets.length > 0, null, { timeout: 20_000 })
})

function frame(source: string, step: string, message: string, extra: unknown = null) {
  return { source, step, message, extra, timestamp: new Date().toISOString() }
}

function send(page: Page, payload: unknown) {
  return page.evaluate((p) => {
    window.__sockets[window.__sockets.length - 1].deliver(p)
  }, payload)
}

/**
 * The value half of a "Current run" stat.
 *
 * Scoped through the label rather than matching on the text, because values like "Running" and
 * "Waiting 3s" also appear in the chrome and the feed.
 */
function runFact(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('..').locator('dd').first()
}

const running = (page: Page) => page.getByText('Running', { exact: true })
const timer = (page: Page) => page.getByRole('timer')
/** The Red Agent column's scroll region, so routing can be asserted rather than mere presence. */
const redLog = (page: Page) => page.getByRole('log', { name: 'Red Agent activity' })

test('counts a delay wait down, then clears it on completion', async ({ page }) => {
  await send(page, frame('system', 'BATCH_START', 'Batch started', { mode: 'agentic', num_trials: 3 }))
  await expect(running(page)).toBeVisible()

  await send(
    page,
    frame('system', 'TRIAL_PLANNED', 'Planned', {
      technique: 'Test-Registry',
      delay: 8,
      trial: 1,
      total: 3,
    }),
  )

  // The plan lands long before the trial resolves, so the card must track it rather than the
  // last finished trial. It names the technique the way the feed does — the raw name — with the
  // MITRE mapping demoted to the sub-line.
  await expect(runFact(page, 'Latest technique')).toHaveText('Test-Registry')

  // These frames arrive tagged `system`. They still have to land in the Red Agent column: the
  // whole point is that a trial's plan, wait and result read as three stacked entries together.
  await expect(redLog(page).getByText('Agent chose Test-Registry')).toBeVisible()

  await send(page, frame('system', 'WAITING', 'Sleeping', { seconds: 6, phase: 'delay' }))
  await expect(timer(page)).toBeVisible()
  await expect(redLog(page).getByRole('timer')).toBeVisible()

  // One frame, many ticks: the count has to shrink on its own between frames.
  const before = Number((await timer(page).textContent())!.match(/\d+/)![0])
  expect(before).toBeGreaterThan(2)
  await page.waitForTimeout(2200)
  const after = Number((await timer(page).textContent())!.match(/\d+/)![0])
  expect(after).toBeLessThan(before)

  await send(
    page,
    frame('system', 'TRIAL_COMPLETE', 'Done', {
      technique: 'Test-Registry',
      detected: true,
      num_alerts: 2,
      time_to_detect: 4.5,
    }),
  )

  // The countdown stops, and what is left is the three-beat sequence of one trial, each beat its
  // own entry in the red column — plan, wait, result — with the wait settled back to its duration.
  await expect(timer(page)).toHaveCount(0)
  await expect(redLog(page).getByText('Agent chose Test-Registry')).toBeVisible()
  await expect(redLog(page).getByText('Waiting 6s…')).toBeVisible()
  await expect(redLog(page).getByText('Detected in 4.5s · 2 alerts')).toBeVisible()

  // The denominator comes from the frame's own `total`, so it survives a refresh where the
  // page's requested-trials state would not. The test frame says 3.
  await expect(runFact(page, 'Progress')).toHaveText('1 of 3')
  await expect(runFact(page, 'Latest result')).toHaveText('4.5s')

  // Grouping: the batch divider names what the run was, and the trial block names which trial
  // these entries belong to, so the feed is not one undifferentiated list.
  await expect(redLog(page).getByText('Batch')).toBeVisible()
  await expect(redLog(page).getByText('agentic · 3 trials')).toBeVisible()
  await expect(redLog(page).getByText('Trial 1 of 3')).toBeVisible()
})

test('labels the observe phase differently', async ({ page }) => {
  await send(page, frame('system', 'BATCH_START', 'Batch started', {}))
  await send(page, frame('system', 'TRIAL_PLANNED', 'Planned', { technique: 'Test-CredAccess' }))
  await send(page, frame('system', 'WAITING', 'Watching Wazuh', { seconds: 30, phase: 'observe' }))

  await expect(timer(page)).toContainText('Observing for')
})

test('an ERROR clears the countdown instead of leaving it stuck', async ({ page }) => {
  await send(page, frame('system', 'BATCH_START', 'Batch started', {}))
  await send(page, frame('system', 'TRIAL_PLANNED', 'Planned', { technique: 'Test-Baseline' }))
  await send(page, frame('system', 'WAITING', 'Sleeping', { seconds: 45, phase: 'delay' }))
  await expect(timer(page)).toBeVisible()

  await send(page, frame('system', 'ERROR', 'Caldera unreachable'))

  await expect(timer(page)).toHaveCount(0)
  await expect(page.getByText('Caldera unreachable').first()).toBeVisible()
})

test('an out-of-order WAITING after its trial closed does not restart the count', async ({ page }) => {
  await send(page, frame('system', 'BATCH_START', 'Batch started', {}))
  await send(page, frame('system', 'TRIAL_PLANNED', 'Planned', { technique: 'Test-Baseline' }))
  await send(page, frame('system', 'WAITING', 'Sleeping', { seconds: 2, phase: 'delay' }))
  await send(
    page,
    frame('system', 'TRIAL_COMPLETE', 'Done', {
      technique: 'Test-Baseline',
      detected: false,
      num_alerts: 0,
      time_to_detect: null,
    }),
  )
  await expect(timer(page)).toHaveCount(0)
  await expect(page.getByText('Not detected · 0 alerts')).toBeVisible()

  // A late frame arriving after the trial it belongs to already resolved. No trial is open ahead
  // of it, so it must be ignored rather than restarting a countdown for a dead trial.
  await send(page, frame('system', 'WAITING', 'Sleeping', { seconds: 30, phase: 'delay' }))
  await page.waitForTimeout(1500)
  await expect(timer(page)).toHaveCount(0)
})

test('a static batch does not credit an agent with choosing', async ({ page }) => {
  // The real BATCH_START carries the mode in its sentence rather than its payload, which is what
  // this reproduces — an empty extra.
  await send(page, frame('system', 'BATCH_START', 'Starting 1 trials in static mode', {}))
  await send(
    page,
    frame('system', 'TRIAL_PLANNED', 'Planned', {
      technique: 'Test-Baseline',
      delay: 0,
      trial: 1,
      total: 1,
    }),
  )

  // The baseline replays a fixed script, so there is no agent to have chosen anything.
  await expect(redLog(page).getByText('Scripted: Test-Baseline')).toBeVisible()
  await expect(redLog(page).getByText(/Agent chose/)).toHaveCount(0)
})

test('completions count only the current batch, not replayed history', async ({ page }) => {
  // An earlier batch, still in the buffer — which is exactly what a refresh delivers now that the
  // server replays recent frames on connect.
  await send(page, frame('system', 'BATCH_START', 'Starting 1 trials in agentic mode', {}))
  await send(page, frame('system', 'TRIAL_PLANNED', 'p', { technique: 'Test-Registry', trial: 1, total: 1 }))
  await send(page, frame('system', 'TRIAL_COMPLETE', 'd', { technique: 'Test-Registry', detected: true, num_alerts: 1, time_to_detect: 1 }))
  await send(page, frame('system', 'TRIAL_COMPLETE', 'd', { technique: 'Test-Registry', detected: true, num_alerts: 1, time_to_detect: 1 }))
  await send(page, frame('system', 'TRIAL_COMPLETE', 'd', { technique: 'Test-Registry', detected: true, num_alerts: 1, time_to_detect: 1 }))

  // A new batch. Its own count starts from zero, and only its own trials count towards it.
  await send(page, frame('system', 'BATCH_START', 'Starting 2 trials in agentic mode', {}))
  await send(page, frame('system', 'TRIAL_PLANNED', 'p', { technique: 'Test-Baseline', trial: 1, total: 2 }))
  await send(page, frame('system', 'TRIAL_COMPLETE', 'd', { technique: 'Test-Baseline', detected: false, num_alerts: 0, time_to_detect: null }))

  await expect(page.getByText('1 of 2 trials completed')).toBeVisible()
  // The three earlier completions must not be counted against this batch.
  await expect(page.getByText('4 of 2 trials completed')).toHaveCount(0)
})

test('elapsed counts from this batch start, not an earlier one', async ({ page }) => {
  await send(page, frame('system', 'BATCH_START', 'First batch', {}))
  await page.waitForTimeout(1100)
  await send(page, frame('system', 'BATCH_COMPLETE', 'First batch done', {}))
  await expect(page.getByText('Idle', { exact: true })).toBeVisible()

  // A second batch. The first BATCH_START is still in the buffer, so taking the earliest one
  // would report the age of the session rather than the age of this run.
  await send(page, frame('system', 'BATCH_START', 'Second batch', {}))
  await expect(running(page)).toBeVisible()

  const seconds = async () => Number((await runFact(page, 'Elapsed').textContent())!.replace('s', ''))
  expect(await seconds()).toBeLessThan(3)

  await page.waitForTimeout(2500)
  expect(await seconds()).toBeGreaterThanOrEqual(2)
})
