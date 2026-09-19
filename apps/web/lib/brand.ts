/**
 * Platform-level default branding for Jelenius, used whenever an
 * organization hasn't configured its own logo/name/color (see
 * `OrganizationConfig.customization.general` in the API for the per-org
 * fields this falls back for). This is the ONLY place these defaults are
 * defined — components should import from here rather than hardcoding a
 * fallback asset path or brand name inline.
 */
export const JELENIUS_BRAND = {
  name: 'Jelenius',
  primaryColor: '#0B1F3A', // navy
  accentColor: '#14B8A6', // teal
  font: 'Inter',
  wordmark: '/jelenius/jelenius-wordmark.svg',
  icon: '/jelenius/jelenius-icon.svg',
  favicon: '/jelenius/jelenius-icon.svg',
} as const
