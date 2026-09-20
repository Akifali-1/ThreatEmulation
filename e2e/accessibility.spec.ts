import { expect, test } from '@playwright/test'

/**
 * Keyboard and focus behaviour.
 *
 * These assert things that are easy to claim and easy to get wrong: that every control is
 * reachable without a mouse, that focus is visibly indicated, and that overlays can be
 * dismissed and return focus where they took it from.
 */

test('every sidebar destination is reachable by keyboard', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Sections' })

  for (const label of ['Live', 'Trials', 'Compare', 'Pipeline Health', 'Methodology']) {
    const link = nav.getByRole('link', { name: label, exact: true })
    await link.focus()
    await expect(link).toBeFocused()
  }
})

test('theme toggle works from the keyboard', async ({ page }) => {
  await page.goto('/')
  const toggle = page.getByRole('button', { name: /Switch to .* theme/ })
  await toggle.focus()
  await expect(toggle).toBeFocused()

  await toggle.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await toggle.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('status popover opens, closes on Escape, and restores focus', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: /System |Partial outage|Systems unreachable|Checking systems/ })
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'System status' })
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('a trial row is focusable and opens the detail drawer with Enter', async ({ page }) => {
  await page.goto('/trials')
  await expect(page.locator('main h1')).toBeVisible({ timeout: 20_000 })

  const row = page.locator('tbody tr[role="button"]').first()
  // Not `waitForLoadState('networkidle')`: the health poll and the socket's reconnect backoff
  // keep the network busy whenever the backend is down, so the page never goes idle.
  const appeared = await row
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false)

  if (!appeared) {
    test.skip(true, 'No trials available (backend unreachable)')
    return
  }

  await row.focus()
  await expect(row).toBeFocused()

  await row.press('Enter')
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()

  // Escape must close it and hand focus back to the row it came from.
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(row).toBeFocused()
})

test('charts expose an accessible name', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main h1')).toBeVisible({ timeout: 20_000 })

  const containers = page.locator('.recharts-responsive-container')
  const appeared = await containers
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false)

  test.skip(!appeared, 'No charts rendered (backend unreachable)')

  // Every chart sits inside a frame whose heading names it, so a screen reader hears what
  // the plot is before its numbers.
  const count = await containers.count()
  for (let i = 0; i < count; i += 1) {
    const hasHeading = await containers
      .nth(i)
      .evaluate((node) => Boolean(node.closest('section')?.querySelector('h2, h3')))
    expect(hasHeading).toBe(true)
  }
})
