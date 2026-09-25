/**
 * Navigation for the public (not-logged-in) organization header.
 *
 * Deliberately kept free of React / config imports so the rules can be unit
 * tested without a DOM (see tests/public-nav.test.mjs).
 *
 * Rules:
 *  - A visitor who is not authenticated gets the simplified public header.
 *    'loading' does not: `SessionGate` blocks rendering until the session
 *    resolves, and treating "unknown" as public would flash the wrong header
 *    at signed-in users.
 *  - Public nav is Home + Courses (when the courses feature is on) + the
 *    school's own explicit choices: a "people" landing section (anchor link)
 *    and custom menu items. Library / Communities / Podcasts / Playgrounds /
 *    Store are LMS-application surfaces and are not advertised here.
 *  - Nothing is invented: every link comes from a route that always exists
 *    (`/`, `/courses`) or from the organization's own configuration.
 */

export interface PublicNavItem {
  key: string
  /** i18n key, used when the item has no literal label */
  labelKey?: string
  /** literal label from organization config */
  label?: string
  href: string
  external: boolean
}

export interface PublicNavInput {
  /** Builds an org-scoped internal href from a path ("/courses" -> "https://org/courses") */
  toHref: (_path: string) => string
  /** Whether a resolved feature is enabled for this org (plan / admin gating) */
  isFeatureEnabled: (_feature: string) => boolean
  /** `customization.menu.items` (or the legacy location) */
  menuItems?: Array<{
    type?: string
    enabled?: boolean
    order?: number
    label?: string
    url?: string
  }>
  /** `customization.landing` */
  landing?: { enabled?: boolean; sections?: Array<{ type?: string; title?: string }> }
}

/** Anchor id used by the landing renderer for its first "people" section. */
export const LANDING_PEOPLE_ANCHOR = 'landing-people'

export function usesPublicHeader(sessionStatus: string | undefined | null): boolean {
  return sessionStatus === 'unauthenticated'
}

const isExternalUrl = (url: string) => /^https?:\/\//i.test(url)

export function buildPublicNav(input: PublicNavInput): PublicNavItem[] {
  const items: PublicNavItem[] = [
    { key: 'home', labelKey: 'common.home', href: input.toHref('/'), external: false },
  ]

  if (input.isFeatureEnabled('courses')) {
    items.push({
      key: 'courses',
      labelKey: 'courses.courses',
      href: input.toHref('/courses'),
      external: false,
    })
  }

  if (input.landing?.enabled) {
    const people = (input.landing.sections || []).find((s) => s?.type === 'people')
    if (people) {
      items.push({
        key: 'people',
        label: people.title || undefined,
        labelKey: people.title ? undefined : 'public_home.people_default_title',
        href: `${input.toHref('/')}#${LANDING_PEOPLE_ANCHOR}`,
        external: false,
      })
    }
  }

  const custom = [...(input.menuItems || [])]
    .filter((m) => m?.type === 'custom' && m.enabled && m.url)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  for (const m of custom) {
    const url = m.url as string
    const external = isExternalUrl(url)
    items.push({
      key: `custom-${url}`,
      label: m.label || url,
      href: external ? url : input.toHref(url),
      external,
    })
  }

  return items
}
