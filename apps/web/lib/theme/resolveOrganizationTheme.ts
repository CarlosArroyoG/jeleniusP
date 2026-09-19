import { JELENIUS_BRAND } from '@/lib/brand'
import { CURATED_FONTS } from '@/lib/fonts'
import { isLightColor } from '@services/utils/ts/colorUtils'
import type { ThemeTokens } from './tokens'

const HEX_COLOR_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * Normalizes a possibly-invalid, possibly-shorthand hex color to `#rrggbb`
 * lowercase, or `null` if the input isn't a plain hex triplet. Mirrors
 * `normalize_brand_color` in `apps/api/src/services/email/branding.py` —
 * keep the two in sync if either changes.
 */
export function normalizeHexColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  const match = HEX_COLOR_RE.exec(trimmed)
  if (!match) return null
  let digits = match[1].toLowerCase()
  if (digits.length === 3) {
    digits = digits.split('').map((c) => c + c).join('')
  }
  return `#${digits}`
}

/**
 * Reads the org's `customization.general` block, tolerating either the v2
 * shape (`config.config.customization.general`) or the older v1 shape
 * (`config.config.general`) — the same dual-path every other consumer in
 * this codebase reads (see OrgMenu.tsx, (withmenu)/layout.tsx).
 */
function readGeneralConfig(org: unknown): Record<string, unknown> {
  const config = (org as any)?.config?.config
  const v2 = config?.customization?.general
  if (v2 && typeof v2 === 'object') return v2
  const v1 = config?.general
  if (v1 && typeof v1 === 'object') return v1
  return {}
}

/**
 * Organization customization → Jelenius theme tokens.
 *
 * This is the single place org branding config gets turned into concrete
 * theme values. It never throws and never returns an invalid value — bad or
 * missing org config silently falls back to the Jelenius default at the
 * field level, not the whole-theme level (an org with a valid color but no
 * font gets its own color plus the Jelenius font, not an all-or-nothing
 * fallback).
 */
export function resolveOrganizationTheme(org: unknown): ThemeTokens {
  const general = readGeneralConfig(org)

  const brandPrimary = normalizeHexColor(general.color) ?? JELENIUS_BRAND.primaryColor
  const brandPrimaryForeground = isLightColor(brandPrimary) ? '#0B1930' : '#ffffff'

  const rawFont = typeof general.font === 'string' ? general.font : ''
  const fontSans = CURATED_FONTS.includes(rawFont) ? rawFont : JELENIUS_BRAND.font

  return {
    brandPrimary,
    brandPrimaryForeground,
    // Not yet an org-configurable field — see ThemeTokens' doc comment.
    brandSecondary: JELENIUS_BRAND.secondaryColor,
    brandAccent: JELENIUS_BRAND.accentColor,
    fontSans,
  }
}

/** `ThemeTokens` as inline-style CSS custom properties, ready to spread onto any wrapper element. */
export function themeTokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--brand-primary': tokens.brandPrimary,
    '--brand-primary-foreground': tokens.brandPrimaryForeground,
    '--brand-secondary': tokens.brandSecondary,
    '--brand-accent': tokens.brandAccent,
    '--font-org-sans': `'${tokens.fontSans}', var(--font-default), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  }
}
