import type { APIRequestContext } from '@playwright/test'

/**
 * Talks to the real backend API (not a mock, not direct DB access) to read
 * and rewrite the dev instance's single organization's branding — the same
 * endpoints the OrgEditBranding admin UI itself calls. Requires the backend
 * stack (`npx learnhouse dev`, or the containers + API it starts) to already
 * be running and reachable — see jelenius-docs/visual-testing.md.
 */

const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:1338/api/v1'
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@jelenius.dev'
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD
const ORG_ID = process.env.PLAYWRIGHT_ORG_ID || '1'
const ORG_SLUG = process.env.PLAYWRIGHT_ORG_SLUG || 'default'

export const JELENIUS_DEFAULT_BRANDING = {
  name: 'Jelenius',
  color: '#0B1930',
  secondary_color: '#172033',
  accent_color: '#19B7A5',
  font: 'Inter',
}

// The exact values named in this phase's own instructions (section 15) for
// the Colegio Demo fixture.
export const COLEGIO_DEMO_BRANDING = {
  name: 'Colegio Demo',
  color: '#7A1F35',
  secondary_color: '#32121A',
  accent_color: '#D6AA52',
  font: 'Merriweather',
}

// A real school identity, used as a test fixture ONLY: colors read from https://www.fdonbosco.org/
// (see jelenius-docs/school-brand-example-donbosco.md). It exercises "same code, different
// OrganizationConfig" — no product code knows about this school.
export const DON_BOSCO_BRANDING = {
  name: 'Fundación Don Bosco',
  color: '#162562',
  secondary_color: '#00001e',
  accent_color: '#ff9d2f',
  font: 'Open Sans',
}

// The example from the task brief: a hypothetical school nobody special-cases.
export const UNIVERSIDAD_ROJA_BRANDING = {
  name: 'Universidad Roja',
  color: '#A32035',
  secondary_color: '#541622',
  accent_color: '#E7B84B',
  font: 'Merriweather',
}

if (!ADMIN_PASSWORD) {
  // Fail loudly and specifically rather than letting every test in the
  // suite fail with an opaque 401/undefined-token error. See
  // jelenius-docs/visual-testing.md's ".env.test.local" prerequisite.
  throw new Error(
    'PLAYWRIGHT_ADMIN_PASSWORD is not set. Create apps/web/.env.test.local ' +
      '(gitignored, same convention as .env.local) with PLAYWRIGHT_ADMIN_PASSWORD ' +
      "set to this dev instance's admin@jelenius.dev password before running the e2e suite. " +
      'See jelenius-docs/visual-testing.md.'
  )
}

let cachedToken: { value: string; expiresAt: number } | null = null

/** `exp` (ms) of a JWT, or 0 when it cannot be read. */
function jwtExpiryMs(jwt: string): number {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0
  } catch {
    return 0
  }
}

/** Forget the cached admin token (it was rejected — see `adminApi`). */
export function dropAdminToken(): void {
  cachedToken = null
}

/**
 * An admin API token, logging in again when there is none. The login is retried once on 429
 * (the API rate-limits logins, see fixtures/login.ts).
 */
export async function getAdminToken(request: APIRequestContext): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.value
  for (let attempt = 0; ; attempt++) {
    const res = await request.post(`${API_URL}/auth/login`, {
      form: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD as string },
    })
    if (res.status() === 429 && attempt < 1) {
      const retryAfter = Number(res.headers()['retry-after']) || 30
      await new Promise((r) => setTimeout(r, Math.min(retryAfter, 60) * 1000))
      continue
    }
    if (!res.ok()) {
      throw new Error(`Admin login failed for the e2e fixture (${res.status()}) — is the dev backend running and is PLAYWRIGHT_ADMIN_PASSWORD correct?`)
    }
    const body = await res.json()
    const value = body.tokens.access_token as string
    cachedToken = { value, expiresAt: jwtExpiryMs(value) || Date.now() + 4 * 60_000 }
    return value
  }
}

type ApiOptions = Parameters<APIRequestContext['fetch']>[1]

/**
 * Authenticated admin API call that survives token revocation.
 *
 * ROOT CAUSE of the intermittent `401 Could not validate credentials` in fixture writes: the API
 * revokes ALL of a user's tokens issued before a logout (`revoke_user_sessions_before`,
 * apps/api/src/security/auth.py). smoke.spec logs the admin out through the UI, which silently
 * invalidated the fixture's cached token; the next spec's first write (ssr-branding) got a 401 even
 * though the token was fresh and unexpired. A 401 therefore drops the cached token, logs in again and
 * retries once.
 */
export async function adminApi(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  options: ApiOptions = {}
) {
  for (let attempt = 0; ; attempt++) {
    const token = await getAdminToken(request)
    const res = await request.fetch(url, {
      ...options,
      method,
      headers: { ...(options?.headers || {}), Authorization: `Bearer ${token}` },
    })
    if (res.status() === 401 && attempt < 1) {
      dropAdminToken()
      continue
    }
    return res
  }
}

export interface Branding {
  name: string
  color: string
  secondary_color: string
  accent_color: string
  font: string
}

/** Reads the current org name + branding fields, for restoring after a test. */
export async function readOrgBranding(request: APIRequestContext): Promise<Branding> {
  const res = await request.get(`${API_URL}/orgs/slug/${ORG_SLUG}`)
  if (!res.ok()) throw new Error(`Could not read org branding for the e2e fixture (${res.status()})`)
  const org = await res.json()
  const general = org?.config?.config?.customization?.general || org?.config?.config?.general || {}
  return {
    name: org.name,
    color: general.color || '',
    secondary_color: general.secondary_color || '',
    accent_color: general.accent_color || '',
    font: general.font || '',
  }
}

/**
 * Sets the org's name + full branding via the real admin API — the exact
 * write path the OrgEditBranding UI uses, not a DB shortcut. Callers are
 * responsible for restoring the previous state afterward (see
 * `withOrgBranding` below for the common pattern).
 */
export async function setOrgBranding(request: APIRequestContext, branding: Branding): Promise<void> {
  const nameRes = await adminApi(request, 'PUT', `${API_URL}/orgs/${ORG_ID}`, {
    data: { name: branding.name },
  })
  if (!nameRes.ok()) throw new Error(`Failed to set org name (${nameRes.status()}): ${await nameRes.text()}`)

  for (const [param, value] of [
    ['color', branding.color],
    ['secondary_color', branding.secondary_color],
    ['accent_color', branding.accent_color],
    ['font', branding.font],
  ] as const) {
    const res = await adminApi(request, 'PUT', `${API_URL}/orgs/${ORG_ID}/config/${param}?${param}=${encodeURIComponent(value)}`)
    if (!res.ok()) throw new Error(`Failed to set org ${param} (${res.status()}): ${await res.text()}`)
  }

  // The API caches org config in Redis (org_cache:config:{id}/slug:{slug}),
  // invalidated by the write path itself, but Next.js's own server-side
  // getServerOrg() (see lib/theme/getServerOrg.ts) additionally revalidates
  // on an 86400s tag, refreshed via revalidateTags(['organizations']) —
  // poll the read-back value instead of a fixed sleep, since either layer's
  // propagation time can vary under load (this is exactly the flakiness a
  // fixed short delay produced when the full suite ran back-to-back).
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    const current = await readOrgBranding(request)
    if (current.name === branding.name && current.color.toLowerCase() === branding.color.toLowerCase()) {
      return
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`Org branding did not propagate to ${API_URL}/orgs/slug/${ORG_SLUG} within 5s of setOrgBranding()`)
}

/** Runs `fn` with the org set to `branding`, then always restores whatever branding was there before — even if `fn` throws. */
export async function withOrgBranding<T>(
  request: APIRequestContext,
  branding: Branding,
  fn: () => Promise<T>
): Promise<T> {
  const previous = await readOrgBranding(request)
  await setOrgBranding(request, branding)
  try {
    return await fn()
  } finally {
    await setOrgBranding(request, previous)
  }
}
