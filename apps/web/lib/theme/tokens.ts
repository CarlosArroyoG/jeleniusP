/**
 * The subset of the Jelenius design system that an organization can
 * actually override today (see `resolveOrganizationTheme`). Everything else
 * — surfaces, text hierarchy, borders, radii, status colors — is a static
 * part of the Jelenius design system and lives directly in
 * `styles/globals.css`'s `@theme`/`:root` blocks, not here; this type only
 * covers the fields `OrganizationConfig.customization.general` actually
 * exposes (`color`, `secondary_color`, `accent_color`, `font`) plus the
 * values derived from them.
 */
export interface ThemeTokens {
  /** Org's `customization.general.color`, or the Jelenius navy default. */
  brandPrimary: string
  /** Auto-resolved black/white for legible text on `brandPrimary` (WCAG 2.1 luminance). */
  brandPrimaryForeground: string
  /** Org's `customization.general.secondary_color`, or the Jelenius ink default. */
  brandSecondary: string
  /** Auto-resolved black/white for legible text on `brandSecondary`. */
  brandSecondaryForeground: string
  /** Org's `customization.general.accent_color`, or the Jelenius teal default. */
  brandAccent: string
  /** Auto-resolved black/white for legible text on `brandAccent`. */
  brandAccentForeground: string
  /** Org's `customization.general.font` (validated against the curated Google Fonts list), or Inter. */
  fontSans: string
}

/** CSS custom-property names the theme engine writes to and Tailwind's `@theme` reads from. */
export const THEME_CSS_VARS = {
  brandPrimary: '--brand-primary',
  brandPrimaryForeground: '--brand-primary-foreground',
  brandSecondary: '--brand-secondary',
  brandSecondaryForeground: '--brand-secondary-foreground',
  brandAccent: '--brand-accent',
  brandAccentForeground: '--brand-accent-foreground',
  fontSans: '--font-org-sans',
} as const satisfies Record<keyof ThemeTokens, string>
