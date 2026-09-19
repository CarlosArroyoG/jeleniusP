'use client'
// Shared legal/footer bits, ported from the platform's look.
//
// AuthFooter   — the "By continuing, you agree to … Terms of Service and
//                Privacy Policy." line shown under the auth forms.
// CopyrightFooter — the "© {year} Jelenius" line for app surfaces
//                (the apex /home hub, the onboarding page, …).
//
// Legal pages live on the marketing/platform site, so links resolve via
// getPlatformUrl(). When no platform URL is configured (default for a
// self-hosted install with no legal pages published yet), we render the
// label as plain text instead of guessing at a URL that doesn't exist.
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getPlatformUrl } from '@services/config/config'

const TERMS_URL = getPlatformUrl('/terms')
const PRIVACY_URL = getPlatformUrl('/privacy')

function LegalLink({ href, children, className }: { href: string | null; children: React.ReactNode; className: string }) {
  if (!href) return <span className={className}>{children}</span>
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </Link>
  )
}

export function AuthFooter({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={`pb-8 pt-6 text-center px-6 ${className}`}>
      <p className="text-[13px] text-black/30 font-medium">
        {t('auth.terms_text', { defaultValue: "By continuing, you agree to Jelenius's" })}{' '}
        <LegalLink href={TERMS_URL} className="text-black/50 hover:text-black/70 transition-colors">
          {t('auth.terms_of_service', { defaultValue: 'Terms of Service' })}
        </LegalLink>{' '}
        {t('auth.and', { defaultValue: 'and' })}{' '}
        <LegalLink href={PRIVACY_URL} className="text-black/50 hover:text-black/70 transition-colors">
          {t('auth.privacy_policy', { defaultValue: 'Privacy Policy' })}
        </LegalLink>
        .
      </p>
    </div>
  )
}

export function CopyrightFooter({
  year,
  className = '',
  tone = 'light',
}: {
  year: number
  className?: string
  // `light` → dark text on light bg; `dark` → light text on dark bg.
  tone?: 'light' | 'dark'
}) {
  const { t } = useTranslation()
  const base = tone === 'dark' ? 'text-white/40' : 'text-black/35'
  const link = tone === 'dark' ? 'text-white/60 hover:text-white/80' : 'text-black/55 hover:text-black/75'
  return (
    <footer className={`w-full py-6 px-6 ${className}`}>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium">
        <p className={base}>
          {t('common.copyright', { defaultValue: '© {{year}} Jelenius', year })}
        </p>
        <nav className="flex items-center gap-x-5">
          <LegalLink href={TERMS_URL} className={`${link} transition-colors`}>
            {t('auth.terms_of_service', { defaultValue: 'Terms of Service' })}
          </LegalLink>
          <LegalLink href={PRIVACY_URL} className={`${link} transition-colors`}>
            {t('auth.privacy_policy', { defaultValue: 'Privacy Policy' })}
          </LegalLink>
        </nav>
      </div>
    </footer>
  )
}
