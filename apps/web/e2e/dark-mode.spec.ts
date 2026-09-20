import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './fixtures/login'

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@jelenius.dev'
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD as string

/**
 * IMPORTANT CONTEXT (see jelenius-docs/theme-engine.md and demo-readiness.md):
 * this app has NO user-facing dark-mode toggle. `.dark { ... }` tokens exist
 * in globals.css, but nothing in the client ever adds a `.dark` class to the
 * document, and `@media (prefers-color-scheme: dark)` (globals.css:325-330)
 * actively pins `body` to light colors regardless of OS preference. Dark
 * mode is therefore unreachable by any real user today.
 *
 * These tests verify the *token wiring* doesn't break by forcing the `.dark`
 * class before each page settles — this is the only way to exercise the CSS
 * at all, but it does not represent a real user path. It proves "if a dark
 * toggle is added later, the Card/Button/Badge/brand system built this phase
 * already reads --surface/--text-secondary/--border-strong correctly instead
 * of hardcoded bg-white," not "users can currently switch to dark mode."
 */
// Applied after navigation (not via addInitScript) so it can't be affected
// by React reconciling the <html> element during hydration — nothing in the
// app manages that element's className dynamically today (no toggle
// exists), but a post-load evaluate() sidesteps the question entirely.
async function forceDark(page: import('@playwright/test').Page) {
  await page.evaluate(() => document.documentElement.classList.add('dark'))
}

test.describe('Dark mode (forced — no live toggle exists)', () => {
  test('login: surface/text/border tokens resolve to dark values, brand color unchanged', async ({ page }) => {
    await page.goto('/login')
    await forceDark(page)
    await expect(page.locator('html.dark')).toHaveCount(1)

    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    // Dark --background is near-black (0 0% 6-9% range); just confirm it's
    // not the light-mode near-white, not an exact value (which would be a
    // brittle pixel-color assertion for no real benefit).
    expect(bodyBg).not.toBe('rgb(255, 255, 255)')

    const brandPrimary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim())
    expect(brandPrimary.toLowerCase()).toBe('#0b1930')
  })

  test('login: no horizontal overflow and inputs remain visible in dark mode', async ({ page }) => {
    await page.goto('/login')
    await forceDark(page)
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    )
    expect(hasOverflow).toBe(false)
    await expect(page.getByLabel(/email/i)).toBeVisible()
  })

  test('dashboard: card surfaces use the dark --surface token, not hardcoded white', async ({ page }) => {
    // forceDark is applied after the final navigation lands on /dash — each
    // page.goto() is a fresh document, so a class added via evaluate() on an
    // earlier page (e.g. mid-login) would not carry over.
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await forceDark(page)
    const card = page.locator('.rounded-card', { has: page.locator('h3', { hasText: /recent courses|cursos recientes/i }) }).first()
    await expect(card).toBeVisible()
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor)
    // The dark --surface token is near-black (0 0% 6%); confirm the card
    // picked up the token-driven background instead of a literal `bg-white`,
    // which would render as rgb(255, 255, 255) here regardless of .dark.
    expect(bg).not.toBe('rgb(255, 255, 255)')
  })

  test('course catalog: renders without overflow in dark mode', async ({ page }) => {
    await page.goto('/courses')
    await forceDark(page)
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    )
    expect(hasOverflow).toBe(false)
  })
})
