import Image from 'next/image'
import React from 'react'
import { JELENIUS_BRAND } from '@/lib/brand'
import { useOrg } from '../Contexts/OrgContext'
import { useTranslation } from 'react-i18next'
import { usePlan } from '@components/Hooks/usePlan'
import { getDeploymentMode } from '@services/config/config'

function Watermark() {
    const { t } = useTranslation()
    const org = useOrg() as any

    const mode = getDeploymentMode()
    const plan = usePlan()
    const watermarkConfig = org?.config?.config?.customization?.general?.watermark ?? org?.config?.config?.general?.watermark

    // Visibility rules, in priority order:
    //   1. EE         → always hidden (white-label is part of the EE license).
    //   2. SaaS free  → always shown (free tier is branded).
    //   3. Otherwise  → respect the admin's toggle (default on).
    if (mode === 'ee') return null
    const showWatermark = plan === 'free' || watermarkConfig !== false
    if (!showWatermark) return null

    return (
        <div
            data-testid="platform-credit"
            className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary/70"
        >
            <span>{t('common.made_with')}</span>
            <Image unoptimized src={JELENIUS_BRAND.wordmark} alt={JELENIUS_BRAND.name} quality={100} width={80} height={24} className="opacity-70" />
        </div>
    )
}

export default Watermark