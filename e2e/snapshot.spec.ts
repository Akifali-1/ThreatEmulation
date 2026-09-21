import { expect, test } from '@playwright/test'

/**
 * Verifies the shared snapshot stands alone.
 *
 * The whole point of the snapshot is that a friend can open it with no backend. So every request
 * to the lab VM is aborted: if anything still renders, it came from the captured files rather
 * than from a live API that happens to be reachable from this machine.
 */

const SNAPSHOT = process.env.SNAPSHOT_URL ?? 'http://localhost:4173'

/*
 * These exercise a build artefact, not the app, so they are inert unless that artefact is being
 * served. Skipping with a reason beats failing on a fresh clone, where nothing is listening.
 */
test.beforeAll(async ({ request }) => {
  try {
    const response = await request.get(SNAPSHOT, { timeout: 5_000 })
    if (!response.ok()) test.skip(true, `${SNAPSHOT} responded ${response.status()}`)
  } catch {
    test.skip(true, `nothing serving ${SNAPSHOT} — run: node share/build-snapshot.mjs && node share/serve.mjs`)
  }
})

test.beforeEach(async ({ page }) => {
  await page.route(/192\.168\.56\.101/, (route) => route.abort())
})

test('landing draws the captured campaign, not an error state', async ({ page }) => {
  await page.goto(SNAPSHOT)
  await expect(page.getByText('166 trials').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('The backend is unreachable')).toHaveCount(0)
})

test('overview renders captured figures', async ({ page }) => {
  await page.goto(`${SNAPSHOT}/overview`)

  // Values straight from /api/trials/summary — 111 of 166 detected.
  await expect(page.getByText('111 of 166 trials detected').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('66.9%').first()).toBeVisible()
})

test('the mode toggle loads the captured static baseline, not the agentic file', async ({ page }) => {
  await page.goto(`${SNAPSHOT}/overview`)
  await expect(page.getByText('111 of 166 trials detected').first()).toBeVisible({ timeout: 20_000 })

  // The two captures differ: agentic is 111/166 at 66.9%, static is 127/165 at 77.0%. A shim that
  // dropped the ?mode query would serve agentic for both and this would never change.
  await page.getByRole('radio', { name: 'Static' }).click()
  await expect(page.getByText('77.0%').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('111 of 166 trials detected')).toHaveCount(0)
})

test('charts load as captured images', async ({ page }) => {
  await page.goto(`${SNAPSHOT}/reports`)
  const chart = page.getByRole('img').first()
  await expect(chart).toBeVisible({ timeout: 20_000 })
  await expect(chart).toHaveAttribute('src', /\/snapshot\/charts-.*\.png/)

  // Actually decoded, rather than a broken-image placeholder with a rewritten src.
  expect(await chart.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0)
})

test('every route deep-links on a cold load', async ({ page }) => {
  const routes = ['/trials', '/techniques', '/compare', '/gaps', '/blue', '/health', '/methodology']
  for (const route of routes) {
    await page.goto(`${SNAPSHOT}${route}`)
    const heading = page.getByRole('main').getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible({ timeout: 20_000 })
    await expect(heading).not.toHaveText('Not found')
  }
})

test('write actions are refused rather than silently failing', async ({ page }) => {
  await page.goto(`${SNAPSHOT}/live`)
  const start = page.getByRole('button', { name: /start|run/i }).first()
  if (await start.count()) {
    await start.click()
    await expect(page.getByText(/static snapshot/i).first()).toBeVisible({ timeout: 10_000 })
  }
})
