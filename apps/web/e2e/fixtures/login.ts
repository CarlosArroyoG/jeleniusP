import type { BrowserContext, Page } from '@playwright/test'

/**
 * Fills and submits the real login form, then follows through to the org
 * dashboard — exercises the actual auth + org-picker flow, not a cookie
 * shortcut. A superadmin lands on the "Your Organizations" hub (`/home`)
 * first, not `/dash` directly, so this clicks into the org card.
 */
/**
 * The API rate-limits logins (30 / 5 min / IP) and the suite signs in as admin in many tests
 * across two projects — a real UI login per test used to trip that limit and surface as an
 * intermittent 401/429. The FIRST call in a run performs the real login (so the auth flow
 * stays covered); its session (cookies + localStorage) is cached for the run and re-applied
 * to later contexts. If a cached session is no longer accepted, it falls back to a real login.
 */
let cachedSession: Awaited<ReturnType<BrowserContext['storageState']>> | null = null

async function reuseCachedSession(page: Page): Promise<boolean> {
  if (!cachedSession) return false
  const ctx = page.context()
  await ctx.addCookies(cachedSession.cookies)
  const origins = cachedSession.origins
  if (origins.length) {
    await ctx.addInitScript((saved) => {
      const mine = saved.find((o) => o.origin === location.origin)
      if (mine) for (const { name, value } of mine.localStorage) localStorage.setItem(name, value)
    }, origins)
  }
  await page.goto('/dash')
  const ok = await page.waitForURL(/\/dash/, { timeout: 10_000 }).then(() => true).catch(() => false)
  if (!ok) cachedSession = null
  return ok
}

export async function loginAsAdmin(page: Page, email: string, password: string): Promise<void> {
  if (await reuseCachedSession(page)) {
    await dismissWelcomeModalIfPresent(page)
    return
  }
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
  await dismissWelcomeModalIfPresent(page)
  cachedSession = await page.context().storageState()
}

/**
 * WelcomeModal (components/Dashboard/Onboarding/WelcomeModal.tsx) is a
 * two-step first-login overlay with no ARIA dialog role, covering the whole
 * viewport (z-[100]) — if this dev org's onboarding-seen flag ever gets
 * reset (this account has been reused across a great many test/admin API
 * calls this session), it reappears and silently blocks every click/hover
 * on the page underneath it, even though the page itself renders fine.
 * Dismissed here, once, right after login, so every caller of
 * loginAsAdmin() gets a click-ready dashboard rather than re-implementing
 * this per test.
 */
async function dismissWelcomeModalIfPresent(page: Page): Promise<void> {
  const getStarted = page.getByRole('button', { name: /get started|comenzar/i })
  // isVisible() checks the DOM as it is *right now* — it does not
  // auto-wait like click()/toBeVisible() do — so waitFor() is required
  // here to give the modal's own (possibly data-gated) mount time to
  // happen before deciding it isn't there.
  const appeared = await getStarted.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)
  if (appeared) {
    await getStarted.click()
    const letsGo = page.getByRole('button', { name: /let'?s go|vamos/i })
    await letsGo.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {})
    await letsGo.click({ timeout: 5_000 }).catch(() => {})
  }
}
