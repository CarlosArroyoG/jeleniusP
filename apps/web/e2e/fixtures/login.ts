import type { Page } from '@playwright/test'

/**
 * Fills and submits the real login form, then follows through to the org
 * dashboard — exercises the actual auth + org-picker flow, not a cookie
 * shortcut. A superadmin lands on the "Your Organizations" hub (`/home`)
 * first, not `/dash` directly, so this clicks into the org card.
 */
export async function loginAsAdmin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /log ?in|sign in/i }).first().click()
  // A superadmin lands on the "Your Organizations" hub (/home), not /dash —
  // its org card links to the org's public home ("/"), not the dashboard,
  // so go there directly rather than trying to reason about where the
  // card's own link lands.
  await page.waitForURL(/\/dash|\/home|\/$/, { timeout: 15_000 })
  if (!/\/dash/.test(page.url())) {
    await page.goto('/dash')
    await page.waitForURL(/\/dash/, { timeout: 15_000 })
  }
}
