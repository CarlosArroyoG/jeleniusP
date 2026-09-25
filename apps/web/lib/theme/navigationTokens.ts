import { MIN_TEXT_CONTRAST, contrastRatio, ensureContrast, mixColors } from './color'

/**
 * BrandTokens → ApplicationThemeTokens.
 *
 * The ONE place that decides which brand color paints which navigation
 * surface. Components never choose "header = primary, sidebar = secondary":
 * they consume `--app-*` variables / `bg-app-*` utilities produced from this.
 *
 * Default ("branded") mapping:
 *   header        = brand primary   / primary foreground
 *   sidebar       = brand secondary / secondary foreground   (mobile nav shares it)
 *   active item   = brand accent    / accent foreground
 *   hover / border / muted text are DERIVED from the surface + its own
 *   foreground (never assumed white-on-dark), so they stay correct on a very
 *   light or very dark school color.
 *
 * Pure (no DOM / React): runs on the server for SSR and in unit tests.
 *
 * Future extension (not implemented — would need an OrganizationConfig field
 * and admin UI): `navigation_style: 'branded' | 'light'`, where 'light' maps
 * header/sidebar to surface tokens and keeps brand only in active state, icons
 * and borders. This function is the single place that would branch on it.
 */

export interface BrandColors {
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  accent: string
  accentForeground: string
}

export interface NavigationTokens {
  headerBackground: string
  headerForeground: string
  /** de-emphasised text on the header (inactive links, icons) */
  headerForegroundMuted: string
  headerHoverBackground: string
  headerBorder: string

  sidebarBackground: string
  sidebarForeground: string
  sidebarForegroundMuted: string
  /** divider lines inside the sidebar / mobile nav */
  navBorder: string

  navHoverBackground: string
  navHoverForeground: string

  navActiveBackground: string
  navActiveForeground: string

  mobileNavBackground: string
  mobileNavForeground: string
}

/** CSS custom property for each navigation token. */
export const NAVIGATION_CSS_VARS = {
  headerBackground: '--app-header-bg',
  headerForeground: '--app-header-fg',
  headerForegroundMuted: '--app-header-fg-muted',
  headerHoverBackground: '--app-header-hover-bg',
  headerBorder: '--app-header-border',
  sidebarBackground: '--app-sidebar-bg',
  sidebarForeground: '--app-sidebar-fg',
  sidebarForegroundMuted: '--app-sidebar-fg-muted',
  navBorder: '--app-nav-border',
  navHoverBackground: '--app-nav-hover-bg',
  navHoverForeground: '--app-nav-hover-fg',
  navActiveBackground: '--app-nav-active-bg',
  navActiveForeground: '--app-nav-active-fg',
  mobileNavBackground: '--app-mobile-nav-bg',
  mobileNavForeground: '--app-mobile-nav-fg',
} as const satisfies Record<keyof NavigationTokens, string>

/** Below this contrast the accent is not distinguishable enough from the sidebar to mark "active". */
const MIN_ACTIVE_SEPARATION = 1.5

/**
 * `mixColors(bg, fg, weight)`, backing off toward `bg` while the tinted surface
 * would no longer keep `fg` legible (AA) — a hover/active tint must never cost
 * the text on it its contrast, whatever the school's color.
 */
function tintKeepingContrast(bg: string, fg: string, weight: number): string {
  let w = weight
  let tinted = mixColors(bg, fg, w)
  while (w > 0.01 && contrastRatio(tinted, fg) < MIN_TEXT_CONTRAST) {
    w = Math.max(0, w - 0.01)
    tinted = mixColors(bg, fg, w)
  }
  return tinted
}

function mutedForeground(foreground: string, background: string): string {
  return ensureContrast(mixColors(foreground, background, 0.3), background, MIN_TEXT_CONTRAST, foreground)
}

export function deriveNavigationTokens(brand: BrandColors): NavigationTokens {
  const header = { bg: brand.primary, fg: brand.primaryForeground }
  const sidebar = { bg: brand.secondary, fg: brand.secondaryForeground }

  // Active item: the accent, unless the accent is too close to the sidebar
  // color to be seen — then fall back to a tint of the sidebar's own
  // foreground so the state is always visible.
  const accentIsDistinct = contrastRatio(brand.accent, sidebar.bg) >= MIN_ACTIVE_SEPARATION
  const active = accentIsDistinct
    ? { bg: brand.accent, fg: brand.accentForeground }
    : { bg: tintKeepingContrast(sidebar.bg, sidebar.fg, 0.22), fg: sidebar.fg }

  return {
    headerBackground: header.bg,
    headerForeground: header.fg,
    headerForegroundMuted: mutedForeground(header.fg, header.bg),
    headerHoverBackground: tintKeepingContrast(header.bg, header.fg, 0.14),
    headerBorder: mixColors(header.bg, header.fg, 0.18),

    sidebarBackground: sidebar.bg,
    sidebarForeground: sidebar.fg,
    sidebarForegroundMuted: mutedForeground(sidebar.fg, sidebar.bg),
    navBorder: mixColors(sidebar.bg, sidebar.fg, 0.14),

    navHoverBackground: tintKeepingContrast(sidebar.bg, sidebar.fg, 0.1),
    navHoverForeground: sidebar.fg,

    navActiveBackground: active.bg,
    navActiveForeground: active.fg,

    mobileNavBackground: sidebar.bg,
    mobileNavForeground: sidebar.fg,
  }
}

export function navigationTokensToCssVars(tokens: NavigationTokens): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(NAVIGATION_CSS_VARS) as Array<keyof NavigationTokens>) {
    out[NAVIGATION_CSS_VARS[key]] = tokens[key]
  }
  return out
}
