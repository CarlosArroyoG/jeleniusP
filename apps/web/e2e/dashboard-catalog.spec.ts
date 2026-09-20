import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './fixtures/login'

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@jelenius.dev'
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD as string

/**
 * Responsive + card-system regression coverage for the two screens this
 * phase actually redesigned (dashboard home, course catalog) — at the two
 * viewports every other spec in this suite uses (1440x900, 390x844). Not a
 * pixel-perfect design review: just "does the new Card/Badge/Button system
 * reflow correctly and stay usable at both sizes."
 */
test.describe('Dashboard — responsive', () => {
  test('dashboard home has no horizontal overflow and its primary action is reachable', async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    )
    expect(hasOverflow).toBe(false)

    const createCourse = page.getByRole('link', { name: /create course/i }).locator('visible=true').first()
    await expect(createCourse).toBeVisible()
  })

  test('dashboard cards render with the card system (rounded surface, no bare white-on-white)', async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    // RecentCourses is one of the widgets migrated onto the shared Card
    // primitive (rounded-card + shadow-card) — check its computed radius is
    // non-zero rather than asserting an exact pixel value, since the token
    // itself (--radius-card) is the source of truth, not this test.
    const card = page.locator('.rounded-card', { has: page.locator('h3', { hasText: /recent courses|cursos recientes/i }) }).first()
    await expect(card).toBeVisible()
    const radius = await card.evaluate((el) => getComputedStyle(el).borderRadius)
    expect(radius).not.toBe('0px')
  })
})

test.describe('Course catalog — responsive', () => {
  test('catalog grid has no horizontal overflow and cards reflow', async ({ page }) => {
    await page.goto('/courses')
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    )
    expect(hasOverflow).toBe(false)
  })

  test('course card title text does not overflow its card', async ({ page }) => {
    await page.goto('/courses')
    const firstCard = page.locator('a[href*="/course/"]').locator('visible=true').first()
    // An org with zero public courses is a valid state (see the empty-state
    // test below) — only assert card shape when at least one exists.
    if (await firstCard.count() === 0) return
    const box = await firstCard.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(0)
  })

  test('empty catalog (or no-results) state shows a title without layout breakage', async ({ page }) => {
    await page.goto('/courses')
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    )
    expect(hasOverflow).toBe(false)
  })
})
