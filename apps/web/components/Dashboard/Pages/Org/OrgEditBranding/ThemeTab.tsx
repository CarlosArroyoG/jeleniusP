'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { Drop, TextAa, X } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  updateOrgColorConfig,
  updateOrgSecondaryColorConfig,
  updateOrgAccentColorConfig,
  updateOrgFontConfig,
} from '@services/settings/org'
import { revalidateTags } from '@services/utils/ts/requests'
import { queryKeys } from '@/lib/query/keys'
import { Input } from '@components/ui/input'
import { Button } from '@components/ui/button'
import { getOrgWideLogoUrl } from '@components/Objects/Org/OrgSquareLogo'
import { pickForeground } from '@/lib/theme/color'
import { JELENIUS_BRAND } from '@/lib/brand'
import FontSelector from './FontSelector'
import { BrandingSection, SaveBar } from './BrandingShared'
import { PublicHeaderVignette } from './BrandingVignettes'

/** Same contrast rule the theme engine uses at runtime (resolveOrganizationTheme.ts) — kept here only for this tab's live preview swatches. */
function previewForeground(hex: string): string {
  return pickForeground(hex, '#ffffff', JELENIUS_BRAND.primaryColor)
}

const SWATCHES = ['#111827', '#1d4ed8', '#0f766e', '#7c3aed', '#be123c', '#d97706', '#f5f5f4']

/** One color picker + hex input + swatches + clear button — the primary,
 * secondary and accent fields are the same control with a different label,
 * value and swatch set, so this is a local helper rather than three copies
 * of the same JSX. */
function ColorField({
  label,
  value,
  onChange,
  disabled,
  clearLabel,
  placeholder,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
  disabled: boolean
  clearLabel: string
  placeholder: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-inset ring-black/10">
        <input
          type="color"
          aria-label={label}
          value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] cursor-pointer border-0 p-0"
        />
      </label>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-32 bg-white font-mono text-sm uppercase"
        maxLength={7}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange('')}
          disabled={disabled}
          className="h-10 px-2 text-gray-400 hover:text-gray-700"
        >
          <X size={14} weight="duotone" className="me-1" />
          {clearLabel}
        </Button>
      )}
    </div>
  )
}

export default function ThemeTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const general = org?.config?.config?.customization?.general || org?.config?.config?.general || {}

  const [primaryColor, setPrimaryColor] = useState<string>(general.color || '')
  const [secondaryColor, setSecondaryColor] = useState<string>(general.secondary_color || '')
  const [accentColor, setAccentColor] = useState<string>(general.accent_color || '')
  const [selectedFont, setSelectedFont] = useState<string>(general.font || '')
  const [saving, setSaving] = useState(false)

  const dirty =
    primaryColor !== (general.color || '') ||
    secondaryColor !== (general.secondary_color || '') ||
    accentColor !== (general.accent_color || '') ||
    selectedFont !== (general.font || '')

  const handleSave = async () => {
    setSaving(true)
    const toastId = toast.loading(t('dashboard.organization.settings.updating'))
    try {
      await Promise.all([
        updateOrgColorConfig(org.id, primaryColor, accessToken),
        updateOrgSecondaryColorConfig(org.id, secondaryColor, accessToken),
        updateOrgAccentColorConfig(org.id, accentColor, accessToken),
        updateOrgFontConfig(org.id, selectedFont, accessToken),
      ])
      await revalidateTags(['organizations'], org.slug)
      queryClient.invalidateQueries({ queryKey: queryKeys.org.detail(org.slug) })
      toast.success(t('dashboard.organization.settings.update_success'), { id: toastId })
      router.refresh()
    } catch (_err) {
      toast.error(t('dashboard.organization.settings.update_error'), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <BrandingSection
        icon={Drop}
        title={t('dashboard.organization.branding.theme.color_title')}
        description={t('dashboard.organization.branding.theme.color_desc')}
      >
        <ColorField
          label={t('dashboard.organization.theme.primary_color')}
          value={primaryColor}
          onChange={setPrimaryColor}
          disabled={saving}
          clearLabel={t('dashboard.organization.branding.theme.clear')}
          placeholder={t('dashboard.organization.branding.theme.no_color')}
        />
        <div className="mt-3 flex items-center gap-1.5">
          {SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              onClick={() => setPrimaryColor(hex)}
              className={`h-6 w-6 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110 ${
                primaryColor.toLowerCase() === hex ? 'ring-2 ring-black ring-offset-2' : ''
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </BrandingSection>

      <BrandingSection
        icon={Drop}
        title={t('dashboard.organization.branding.theme.secondary_color_title')}
        description={t('dashboard.organization.branding.theme.secondary_color_desc')}
      >
        <ColorField
          label={t('dashboard.organization.branding.theme.secondary_color_title')}
          value={secondaryColor}
          onChange={setSecondaryColor}
          disabled={saving}
          clearLabel={t('dashboard.organization.branding.theme.clear')}
          placeholder={t('dashboard.organization.branding.theme.no_color')}
        />
      </BrandingSection>

      <BrandingSection
        icon={Drop}
        title={t('dashboard.organization.branding.theme.accent_color_title')}
        description={t('dashboard.organization.branding.theme.accent_color_desc')}
      >
        <ColorField
          label={t('dashboard.organization.branding.theme.accent_color_title')}
          value={accentColor}
          onChange={setAccentColor}
          disabled={saving}
          clearLabel={t('dashboard.organization.branding.theme.clear')}
          placeholder={t('dashboard.organization.branding.theme.no_color')}
        />
      </BrandingSection>

      <BrandingSection
        icon={TextAa}
        title={t('dashboard.organization.branding.theme.font_title')}
        description={t('dashboard.organization.branding.theme.font_desc')}
      >
        <FontSelector value={selectedFont} onChange={setSelectedFont} />
      </BrandingSection>

      <section className="px-5 py-7 border-t border-gray-100">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {t('dashboard.organization.branding.theme.preview')}
        </p>
        <PublicHeaderVignette
          large
          wideUrl={getOrgWideLogoUrl(org)}
          name={org?.name}
          primaryColor={primaryColor}
          font={selectedFont}
          label={t('dashboard.organization.branding.vignettes.public_header')}
        />
        {/* Button/badge preview for the two fields the header vignette above
            doesn't cover — resolved with the same Jelenius-default fallback
            and contrast rule the live app uses (resolveOrganizationTheme.ts),
            so what's shown here matches what saving will actually produce. */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          {(() => {
            const previewAccent = accentColor || JELENIUS_BRAND.accentColor
            const previewSecondary = secondaryColor || JELENIUS_BRAND.secondaryColor
            return (
              <>
                <button
                  type="button"
                  className="rounded-[10px] px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: previewAccent, color: previewForeground(previewAccent) }}
                >
                  {t('dashboard.organization.branding.theme.preview_button')}
                </button>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ backgroundColor: previewSecondary, color: previewForeground(previewSecondary) }}
                >
                  {t('dashboard.organization.branding.theme.preview_badge')}
                </span>
              </>
            )
          })()}
        </div>
      </section>

      <SaveBar onSave={handleSave} saving={saving} disabled={!dirty} note={t('dashboard.organization.branding.theme.note')} />
    </div>
  )
}
