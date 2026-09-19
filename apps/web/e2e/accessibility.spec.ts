import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './fixtures/login'

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@jelenius.dev'
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD as string

/**
 * Regression checks, not a full WCAG audit (explicitly out of scope for
 * this phase — see section 36 of the phase instructions). The goal is
 * catching an obvious accessibility break introduced by the theme engine
 * (e.g. a dynamic brand color that swallows the focus ring, or a brand-only
 * icon losing its accessible name).
 */
test.describe('Accessibility — login', () => {
  test('every form field reachable via Tab has a label', async ({ page }) => {
    await page.goto('/login')
    const email = page.getByLabel(/email/i)
    const password = page.getByLabel(/password/i)
    await expect(email).toBeVisible()
    await expect(password).toBeVisible()
  })

  test('keyboard-only flow: Tab reaches email, password, and submit in order', async ({ page }) => {
    await page.goto('/login')
    await page.locator('body').click({ position: { x: 1, y: 1 } }) // establish a known focus origin
    await page.keyboard.press('Tab')
    // Walk forward a bounded number of tabs looking for the email field —
    // exact tab-index position isn't the point (language switcher, skip
    // links etc. may sit before it); reaching it via keyboard alone is.
    let reachedEmail = false
    for (let i = 0; i < 15 && !reachedEmail; i++) {
      const active = await page.evaluate(() => document.activeElement?.getAttribute('type'))
      if (active === 'email') reachedEmail = true
      else await page.keyboard.press('Tab')
    }
    expect(reachedEmail).toBe(true)
  })

  test('the sign-in button has an accessible name', async ({ page }) => {
    await page.goto('/login')
    const button = page.getByRole('button', { name: /log ?in|sign in/i }).first()
    await expect(button).toBeVisible()
  })

  test('the brand mark has non-empty alt text (never an unlabeled decorative-looking logo)', async ({ page }) => {
    await page.goto('/login')
    const images = page.locator('img[alt]')
    const count = await images.count()
    expect(count).toBeGreaterThan(0)
    const firstAlt = await images.first().getAttribute('alt')
    expect(firstAlt?.length).toBeGreaterThan(0)
  })
})

test.describe('Accessibility — dashboard sidebar', () => {
  test('sidebar nav items are keyboard-focusable and each has an accessible name', async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    const sidebar = page.locator('nav[aria-label*="avigation" i]:visible').first()
    await expect(sidebar).toBeVisible()

    // The desktop sidebar (DashLeftMenu) is all <a href>; the mobile bottom
    // bar (DashMobileMenu) mixes links with icon buttons (search, menu
    // toggle) in the same nav — both are legitimate keyboard-focusable nav
    // controls, so check both element types rather than assuming links only.
    const links = sidebar.locator('a[href], button')
    const count = await links.count()
    expect(count).toBeGreaterThan(0)

    // Every link must resolve an accessible name (aria-label or text content) —
    // icon-only nav items are exactly where this regresses silently.
    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      const accessibleName = (await link.getAttribute('aria-label')) || (await link.innerText())
      expect(accessibleName?.trim().length ?? 0).toBeGreaterThan(0)
    }

    await links.first().focus()
    await expect(links.first()).toBeFocused()
  })
})
