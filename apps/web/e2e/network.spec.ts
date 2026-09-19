import { test, expect } from '@playwright/test'

/**
 * Confirms the SSR hydration wiring (getServerOrgTheme + HydrationBoundary,
 * see jelenius-docs/ssr-branding.md) actually collapses the org fetch to
 * one network round-trip per page load, instead of one server-side fetch
 * (for metadata/theme) plus a second client-side fetch once OrgContext's
 * useQuery mounts (which is what happened before this phase — see
 * jelenius-docs/frontend-audit.md's phase 2 addendum).
 *
 * This only counts requests the BROWSER makes after the page is delivered
 * (Playwright can't observe the server's own outbound calls to the API) —
 * that's fine, because the whole point of hydration is that the browser
 * should make ZERO follow-up org requests when the SSR'd data is already
 * fresh. A getServerOrg() cache() dedup on the SERVER side (metadata fetch
 * + layout body fetch → one call) is verified separately by code
 * inspection / the "not(:root) same value" SSR test — cache() is a React
 * primitive with no browser-observable network signal.
 */
test.describe('network — no duplicate organization fetch on initial load', () => {
  test('loading / makes zero client-side requests to /orgs/slug/* — the SSR-hydrated data is used as-is', async ({ page }) => {
    const orgRequests: string[] = []
    page.on('request', (req) => {
      if (/\/orgs\/slug\//.test(req.url())) orgRequests.push(req.url())
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    expect(orgRequests, `client made ${orgRequests.length} browser-side org fetch(es): ${orgRequests.join(', ')}`).toHaveLength(0)
  })

  test('loading /login makes zero client-side requests to /orgs/slug/*', async ({ page }) => {
    const orgRequests: string[] = []
    page.on('request', (req) => {
      if (/\/orgs\/slug\//.test(req.url())) orgRequests.push(req.url())
    })

    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    expect(orgRequests, `client made ${orgRequests.length} browser-side org fetch(es): ${orgRequests.join(', ')}`).toHaveLength(0)
  })
})
