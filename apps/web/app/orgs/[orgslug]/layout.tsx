import type React from 'react'
import { Metadata } from 'next'
import { HydrationBoundary } from '@tanstack/react-query'
import { OrgProvider } from '@components/Contexts/OrgContext'
import OrgLanguageSync from '@components/Contexts/OrgLanguageSync'
import NextTopLoader from 'nextjs-toploader'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import '@styles/globals.css'
import Footer from '@components/Footer/Footer'
import CompleteSignupFields from '@components/Auth/CompleteSignupFields'
import { getOrgFaviconMediaDirectory } from '@services/media/media'
import { getServerOrg } from '@/lib/theme/getServerOrg'
import { getServerOrgTheme } from '@/lib/theme/getServerOrgTheme'
import { themeVarsToRootCss } from '@/lib/theme/resolveOrganizationTheme'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgslug: string }>
}): Promise<Metadata> {
  const { orgslug } = await params
  // getServerOrg is memoized (React cache()) — the layout body below fetches
  // the same orgslug and this resolves to the same in-flight/cached promise
  // rather than a second network round-trip.
  const org = await getServerOrg(orgslug)
  const faviconImage = org?.config?.config?.customization?.general?.favicon_image || org?.config?.config?.general?.favicon_image
  if (faviconImage) {
    return {
      icons: { icon: getOrgFaviconMediaDirectory(org.org_uuid, faviconImage) },
    }
  }
  return {}
}

export default async function RootLayout(props: {
  children: React.ReactNode
  params: Promise<{ orgslug: string }>
}) {
  const params = await props.params
  // Same memoized fetch as generateMetadata above (see getServerOrg's doc
  // comment) — this also resolves the theme and prepares a React Query
  // hydration payload so OrgContext's client-side useQuery finds the data
  // already cached instead of re-fetching on mount.
  const { style, dehydratedState } = await getServerOrgTheme(params.orgslug)

  return (
    <div style={style}>
      {/* Same tokens on :root, in the server HTML: UI portaled to <body> (mobile nav,
          flyouts, dialogs) sits outside this wrapper and would otherwise see the
          Jelenius defaults. */}
      <style dangerouslySetInnerHTML={{ __html: themeVarsToRootCss(style) }} />
      <HydrationBoundary state={dehydratedState}>
        <OrgProvider orgslug={params.orgslug}>
          <OrgLanguageSync />
          <NextTopLoader color="#2e2e2e" initialPosition={0.3} height={4} easing={'ease'} speed={500} showSpinner={false} />
          <Toast />
          <CompleteSignupFields />
          {props.children}
          <Footer />
        </OrgProvider>
      </HydrationBoundary>
    </div>
  )
}
