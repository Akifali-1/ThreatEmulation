import { expect, test } from '@playwright/test'

/**
 * Landing page capture.
 *
 * The field replays the whole campaign on a loop, so a single screenshot only ever shows one
 * moment of it. These capture the replay at three points in its cycle, then the scroll beats.
 */

async function hold(page: import('@playwright/test').Page, ms: number) {
  await page.waitForTimeout(ms)
}

test('landing: replay mid-flight', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 })
  // Let data settle, then catch the replay partway through.
  await hold(page, 2500)
  await page.screenshot({ path: `screenshots/${testInfo.project.name}/1-replay-mid.png` })
  // ...and near the end, when the field is full.
  await hold(page, 11_000)
  await page.screenshot({ path: `screenshots/${testInfo.project.name}/2-replay-full.png` })
})

const BEATS = [
  { name: '3-escalation', progress: 0.4 },
  { name: '4-payoff', progress: 0.72 },
  { name: '5-explore', progress: 1.0 },
]

for (const beat of BEATS) {
  test(`landing: ${beat.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 })
    await hold(page, 1200)

    // Derived rather than hardcoded: the driver height is a tuning constant in Landing.tsx, and
    // a literal here silently captures the wrong beats the next time it is adjusted.
    const span = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    )
    await page.evaluate((y) => window.scrollTo(0, y), span * beat.progress)
    await hold(page, 1600)

    await page.screenshot({ path: `screenshots/${testInfo.project.name}/${beat.name}.png` })
  })
}

test('landing: the techniques are isolatable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 })

  const span = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  )
  await page.evaluate((y) => window.scrollTo(0, y), span)
  await hold(page, 1600)

  const chip = page.getByRole('button', { name: /T1070\.003/ })
  await expect(chip).toBeVisible({ timeout: 10_000 })
  await chip.click()
  await hold(page, 1500)

  await page.screenshot({ path: `screenshots/${testInfo.project.name}/6-isolated.png` })
})

test('landing: links through to the dashboard', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Dashboard/ }).first().click()
  await expect(page).toHaveURL(/\/overview/)
  await expect(page.locator('main h1')).toHaveText('Overview')
})
