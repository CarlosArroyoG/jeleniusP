'use client'
import React from 'react'
import Link from 'next/link'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { BrandIcon } from '@components/Brand/BrandMark'

/**
 * The organization's identity in the header — shared by the authenticated
 * (`OrgMenu`) and public (`OrgPublicHeader`) headers so both always show the
 * same thing: the uploaded logo, or (when the school has none) the platform
 * icon next to the school's NAME. The name inherits the header foreground, so
 * it stays legible on any brand color.
 */
export function OrgHeaderLogo({ orgslug, testId }: { orgslug: string; testId?: string }) {
  const org = useOrg() as any
  return (
    <Link
      href={getUriWithOrg(orgslug, '/')}
      className="flex h-9 min-w-0 items-center gap-2.5 rounded-md"
      data-testid={testId}
    >
      {org?.logo_image ? (
        <img
          src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)}
          alt={org?.name || 'Organization logo'}
          style={{ width: 'auto', height: '100%' }}
          className="rounded-md py-0.5"
        />
      ) : (
        <>
          <BrandIcon className="h-8 w-8 shrink-0 rounded-lg" />
          <span className="truncate text-base font-bold text-app-header-foreground">{org?.name}</span>
        </>
      )}
    </Link>
  )
}

export default OrgHeaderLogo
