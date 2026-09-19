'use client'
import React from 'react'
import Image from 'next/image'
import { JELENIUS_BRAND } from '@/lib/brand'

/**
 * Platform default wordmark (icon + name). Used wherever an organization
 * hasn't uploaded its own wide logo — see `OrgSquareLogo`/`getOrgWideLogoUrl`
 * for the per-org lookup this falls back for.
 */
export function BrandWordmark({
  className,
  width = 133,
  height = 40,
  style,
}: {
  className?: string
  width?: number
  height?: number
  style?: React.CSSProperties
}) {
  return (
    <Image
      src={JELENIUS_BRAND.wordmark}
      alt={`${JELENIUS_BRAND.name} logo`}
      width={width}
      height={height}
      style={{ height: 'auto', ...style }}
      className={className}
    />
  )
}

/** Platform default square icon. Used in sidebars/avatars when an org has no logo. */
export function BrandIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={JELENIUS_BRAND.icon} alt={`${JELENIUS_BRAND.name} logo`} className={className} />
}

export function BrandName() {
  return <>{JELENIUS_BRAND.name}</>
}
