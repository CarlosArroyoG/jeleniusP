import { test, expect } from '@playwright/test'
import { JELENIUS_DEFAULT_BRANDING } from './fixtures/org-branding'

/**
 * Runs once per project (chromium-desktop @ 1440x900, chromium-mobile @
 * 390x844 — see playwright.config.ts), so every test here is exercised at
 * both sizes automatically.
 */
test.describe('Login — Jelenius branding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('brand logo is visible', async ({ page }) => {
    // BrandIcon/BrandWordmark always render with alt text containing the
    // brand name (see components/Brand/BrandMark.tsx) — org has no logo
    // uploaded in this dev fixture, so this is the Jelenius fallback mark.
    // AuthLayout renders both the mobile header's logo (hidden via CSS
    // above the lg breakpoint) and the desktop panel's logo in the same
    // DOM — :visible filters to whichever one this viewport actually shows.
    const logo = page.locator('img[alt*="Jelenius" i]:visible').first()
    await expect(logo).toBeVisible()
  })

  test('organization name text is visible on the page', async ({ page }) => {
    const name = page.getByText(JELENIUS_DEFAULT_BRANDING.name, { exact: false }).locator('visible=true').first()
    await expect(name).toBeVisible()
  })

  test('email and password inputs are visible', async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('sign-in button is visible and enabled', async ({ page }) => {
    const button = page.getByRole('button', { name: /log ?in|sign in/i }).first()
    await expect(button).toBeVisible()
    await expect(button).toBeEnabled()
  })

  test('email input shows a visible focus state', async ({ page }) => {
    const email = page.getByLabel(/email/i)
    await email.focus()
    await expect(email).toBeFocused()
    // A visible focus ring matters for accessibility (see section 24/36 of
    // this phase) — assert the browser actually painted an outline/box-shadow,
    // not just that focus moved.
    const hasVisibleFocusStyle = await email.evaluate((el) => {
      const s = getComputedStyle(el)
      return s.outlineStyle !== 'none' || s.boxShadow !== 'none'
    })
    expect(hasVisibleFocusStyle).toBe(true)
  })

  test('no horizontal overflow at this viewport (no layout break)', async ({ page }) => {
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    )
    expect(hasHorizontalOverflow).toBe(false)
  })

  test('the primary button uses the brand accent color, not a hardcoded black', async ({ page }) => {
    const button = page.getByRole('button', { name: /log ?in|sign in/i }).first()
    const bg = await button.evaluate((el) => getComputedStyle(el).backgroundColor)
    // rgb(0, 0, 0) is what the pre-phase-3 hardcoded `bg-black` rendered as —
    // the theme-engine button must not still be that.
    expect(bg).not.toBe('rgb(0, 0, 0)')
  })
})
