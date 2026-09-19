import 'server-only'
import { QueryClient, dehydrate, type DehydratedState } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { resolveOrganizationTheme, themeTokensToCssVars } from './resolveOrganizationTheme'
import { getServerOrg } from './getServerOrg'
import type { ThemeTokens } from './tokens'

export interface ServerOrgTheme {
  org: any | null
  tokens: ThemeTokens
  /** CSS custom properties — spread onto the layout's root element so the
   * organization's actual brand color/font are in the very first byte of
   * HTML, not just after client hydration. */
  style: Record<string, string>
  /** Pass to <HydrationBoundary state={...}> wrapping <OrgProvider>, so
   * OrgContext's client-side useQuery(queryKeys.org.detail(orgslug)) finds
   * this data already in the cache — same query key, same shape — instead
   * of re-fetching on mount. */
  dehydratedState: DehydratedState
}

/**
 * Everything a Server Component layout needs to render an organization's
 * theme in the initial HTML and hand React Query a warm cache for it.
 *
 * `resolveOrganizationTheme` (the single source of truth for org config →
 * theme tokens, used identically on client and server) is not duplicated
 * here — this only adds the server-specific plumbing (fetch + hydration
 * state) around that one function.
 */
export async function getServerOrgTheme(orgslug: string | null): Promise<ServerOrgTheme> {
  const org = await getServerOrg(orgslug)
  const tokens = resolveOrganizationTheme(org)
  const style = themeTokensToCssVars(tokens)

  const queryClient = new QueryClient()
  // Only seed the cache on a successful fetch — if the server-side fetch
  // failed (network hiccup, backend blip), leave the query unseeded so the
  // client's own useQuery retries fresh instead of being stuck with a
  // poisoned "no org" result for its full staleTime.
  if (orgslug && org) {
    queryClient.setQueryData(queryKeys.org.detail(orgslug), org)
  }
  const dehydratedState = dehydrate(queryClient)

  return { org, tokens, style, dehydratedState }
}
