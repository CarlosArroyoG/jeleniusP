import 'server-only'
import { cache } from 'react'
import { getOrganizationContextInfo } from '@services/organizations/orgs'

/**
 * Server-side organization fetch, memoized per request via React's cache().
 *
 * `app/orgs/[orgslug]/layout.tsx` needs the same organization in two places
 * that Next.js calls independently — `generateMetadata()` and the layout
 * component body (the latter to seed React Query's hydration cache and
 * compute the SSR theme, see getServerOrgTheme.ts). `getOrganizationContextInfo`
 * always sends `cache: 'no-store'` (see requests.ts — access state can change
 * at any time, so it deliberately opts out of the HTTP cache), which means
 * calling it twice really does make two network round-trips. Wrapping it in
 * `cache()` — a plain per-render-pass memoization, unrelated to HTTP
 * caching — collapses both call sites back to one fetch, which is the
 * whole point: this function's identity (same module-level reference) is
 * what makes the memoization actually apply, so call THIS everywhere a
 * Server Component needs the org, rather than calling
 * `getOrganizationContextInfo` directly.
 *
 * Never throws — a fetch failure here must not break the page shell.
 */
export const getServerOrg = cache(async (orgslug: string | null): Promise<any | null> => {
  if (!orgslug) return null
  try {
    const org = await getOrganizationContextInfo(orgslug, {
      revalidate: 86400,
      tags: ['organizations'],
    })
    if (!org || org.error) return null
    return org
  } catch {
    return null
  }
})
