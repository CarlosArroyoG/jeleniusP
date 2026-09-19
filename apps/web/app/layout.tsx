import '../styles/globals.css'
import React from 'react'
import type { Metadata } from 'next'
import Providers from '@components/Providers'
import { Inter, Tajawal } from 'next/font/google'
import { JELENIUS_BRAND } from '@/lib/brand'

// Platform-level fallback metadata — an organization's own title/favicon
// (set via generateMetadata in app/orgs/[orgslug]/layout.tsx) takes
// precedence whenever one is configured; this only applies on routes with
// no org context (the apex/home, /admin, auth error pages, …).
export const metadata: Metadata = {
  title: JELENIUS_BRAND.name,
  description: 'Jelenius — the learning platform for your school.',
  icons: {
    icon: JELENIUS_BRAND.favicon,
  },
}

// Inter is the Jelenius identity font (jelenius-docs/brand-reference.md).
// This is the platform *default* only — an organization that has set its
// own `customization.general.font` still overrides it via the theme engine
// (lib/theme/resolveOrganizationTheme.ts) on org-scoped pages.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-default',
})

// Inter has no Arabic subset, so Arabic would otherwise fall back to
// whatever the OS provides — Geeza Pro, Segoe UI, Noto — and look like a
// different product on every platform.
//
// Tajawal is the Arabic face for the whole product. It is FORCED whenever the
// UI is Arabic (see globals.css), not merely offered as a fallback: Tajawal
// ships a Latin subset too, so a mixed Arabic screen renders in one typeface
// instead of switching per glyph between two designs with different
// proportions.
//
// Weights are 200-900 with no 600 — a `font-semibold` element rounds up to 700,
// which is the intended reading.
const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '700', '800'],
  display: 'swap',
  variable: '--font-arabic',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // `dir` is deliberately absent from the <html> below. React only reconciles
  // attributes present in its virtual tree, so leaving it out means React never
  // clobbers what dir-init.js wrote before paint. `lang="en"` stays as the
  // no-JS baseline for crawlers; the script overwrites it for everyone else.
  return (
    <html
      className={`${inter.variable} ${tajawal.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        {/* Synchronous script — sets <html lang/dir> before body paints so an
            RTL locale never flashes an LTR layout. Must run first. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/dir-init.js" />
        {/* Synchronous script — blocks parsing to guarantee window.__RUNTIME_CONFIG__ exists before any JS runs.
            Next.js <Script strategy="beforeInteractive"> is not truly blocking in all browsers (Safari). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/runtime-config.js" />
        {/* Prevent white flash on embed routes: set html+body bg before body is painted.
            Reads the optional ?bgcolor param (hex-validated) or defaults to dark. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/embed-bg.js" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <main className="animate-fade-in">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
