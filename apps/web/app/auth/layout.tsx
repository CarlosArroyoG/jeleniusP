import type { ReactNode } from 'react'
import { HydrationBoundary } from '@tanstack/react-query'
import { OrgProvider } from '@components/Contexts/OrgContext'
import OrgLanguageSync from '@components/Contexts/OrgLanguageSync'
import { getAuthOrgSlug } from '@services/org/orgResolution'
import { getServerOrgTheme } from '@/lib/theme/getServerOrgTheme'

export default async function AuthLayout({
    children,
}: {
    children: ReactNode
}) {
    const orgslug = await getAuthOrgSlug()

    // No org slug → bare apex (learn.io) → generic, org-less auth pages. No
    // OrgProvider; the page renders the Jelenius default (already :root's
    // default CSS vars, nothing to hydrate).
    if (!orgslug) {
        return <>{children}</>
    }

    // Fetched once here and handed to the client via HydrationBoundary, so
    // OrgContext's useQuery(queryKeys.org.detail(orgslug)) — used by
    // AuthLayout.tsx/AuthBrandingPanel.tsx for logo/name/color — finds it
    // already cached instead of re-fetching, and the org's actual brand
    // color/font are in the server-rendered HTML from the first byte.
    const { style, dehydratedState } = await getServerOrgTheme(orgslug)

    return (
        <div style={style}>
            <HydrationBoundary state={dehydratedState}>
                <OrgProvider orgslug={orgslug}>
                    <OrgLanguageSync />
                    {children}
                </OrgProvider>
            </HydrationBoundary>
        </div>
    )
}
