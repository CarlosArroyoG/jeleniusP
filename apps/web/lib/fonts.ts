export const CURATED_FONTS = [
  'Albert Sans',
  'Barlow',
  'Cabin',
  'DM Sans',
  'Exo 2',
  'Figtree',
  'Fira Sans',
  'IBM Plex Sans',
  'Instrument Sans',
  'Inter',
  'Josefin Sans',
  'Karla',
  'Lato',
  'Lexend',
  'Libre Franklin',
  'Manrope',
  // The list's only serif — added for institutions that want a more
  // traditional/academic look than the rest of this (all sans-serif) list
  // offers. See jelenius-docs/visual-testing.md's Colegio Demo fixture.
  'Merriweather',
  'Montserrat',
  'Mulish',
  'Noto Sans',
  'Nunito',
  'Onest',
  'Open Sans',
  'Outfit',
  'Overpass',
  'Plus Jakarta Sans',
  'Poppins',
  'PT Sans',
  'Quicksand',
  'Raleway',
  'Red Hat Display',
  'Roboto',
  'Rubik',
  'Source Sans 3',
  'Sora',
  'Space Grotesk',
  'Titillium Web',
  'Urbanist',
  'Wix Madefor Text',
  'Work Sans',
]

// Jelenius's own identity font (see jelenius-docs/brand-reference.md).
// Kept in sync with the `Inter` import in app/layout.tsx — that's what's
// actually loaded, this just tells consumers which curated-list entry is
// "no override needed".
export const DEFAULT_FONT = 'Inter'

export function getGoogleFontUrl(fontFamily: string): string {
  const encoded = fontFamily.replace(/ /g, '+')
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`
}

export function getGoogleFontPreviewUrl(fontFamily: string): string {
  const encoded = fontFamily.replace(/ /g, '+')
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700&display=swap`
}
