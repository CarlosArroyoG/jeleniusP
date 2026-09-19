/**
 * Platform-level default branding for Jelenius, used whenever an
 * organization hasn't configured its own logo/name/color (see
 * `OrganizationConfig.customization.general` in the API for the per-org
 * fields this falls back for). This is the ONLY place these defaults are
 * defined — components should import from here rather than hardcoding a
 * fallback asset path or brand name inline.
 *
 * Values are taken verbatim from the official brand reference,
 * https://jelenius.com.mx/ (its `:root` CSS custom properties and
 * `assets/logo/jelenius-mark.svg`) — see jelenius-docs/brand-reference.md
 * for the full extraction. Do not hand-tune these independently of that
 * document; update both together.
 */
export const JELENIUS_BRAND = {
  name: 'Jelenius',
  primaryColor: '#0B1930', // --navy
  secondaryColor: '#172033', // --ink
  accentColor: '#19B7A5', // --teal
  tertiaryColor: '#2F80ED', // --blue (used sparingly, e.g. the mark's third shape)
  mutedColor: '#667085', // --muted
  lineColor: '#e7e9ee', // --line
  surfaceColor: '#F7F8F5', // --ivory
  font: 'Inter',
  wordmark: '/jelenius/jelenius-wordmark.svg',
  icon: '/jelenius/jelenius-icon.svg',
  favicon: '/jelenius/jelenius-icon.svg',
} as const
