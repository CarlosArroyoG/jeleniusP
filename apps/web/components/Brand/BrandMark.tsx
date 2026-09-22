'use client'
import React from 'react'
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
    <span
      role="img"
      aria-label={`${JELENIUS_BRAND.name} logo`}
      className={`inline-flex items-center gap-2.5 overflow-visible ${className || ''}`}
      style={{ height, width, ...style }}
    >
      <img
        src={JELENIUS_BRAND.icon}
        alt=""
        aria-hidden="true"
        className="h-full w-auto shrink-0 rounded-[23%]"
      />
      <span className="whitespace-nowrap text-[0.8em] font-extrabold leading-none tracking-[0.18em]">
        {JELENIUS_BRAND.name.toUpperCase()}
      </span>
    </span>
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
