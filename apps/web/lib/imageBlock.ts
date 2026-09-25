/**
 * Sizing rules for the editor's Image block (`blockImage` TipTap node).
 *
 * The same helpers are used by the editor NodeView (instructor) and the
 * learner view, so both always agree on how an image is sized.
 *
 * Attributes live inside the Dynamic Page's JSON document (no DB columns):
 *   - `widthPreset`: '25' | '50' | '75' | '100' — percent of the usable
 *     content width. New in this feature; absent on older content.
 *   - `size`: { width: number } — the legacy fixed pixel width set by the
 *     drag handle. Still honoured when `widthPreset` is absent, so images
 *     saved before presets existed render exactly as they always did.
 *   - `alignment`: 'left' | 'center' | 'right' (default 'center').
 *   - `alt`: string — accessible description (new; older content has none).
 *
 * Pure (no React / DOM) so it can be unit tested.
 */

export const IMAGE_WIDTH_PRESETS = ['25', '50', '75', '100'] as const
export type ImageWidthPreset = (typeof IMAGE_WIDTH_PRESETS)[number]
export type ImageAlignment = 'left' | 'center' | 'right'

/** Pixel width the block has always defaulted to before presets existed. */
export const LEGACY_IMAGE_WIDTH_PX = 300

/** Accepts '50', 50 and '50%'; anything else is "no preset". */
export function normalizeWidthPreset(value: unknown): ImageWidthPreset | null {
  if (value === null || value === undefined) return null
  const raw = String(value).trim().replace(/%$/, '')
  return (IMAGE_WIDTH_PRESETS as readonly string[]).includes(raw) ? (raw as ImageWidthPreset) : null
}

export function normalizeAlignment(value: unknown): ImageAlignment {
  return value === 'left' || value === 'right' ? value : 'center'
}

export function alignmentItemsClass(alignment: unknown): 'items-start' | 'items-center' | 'items-end' {
  const a = normalizeAlignment(alignment)
  return a === 'left' ? 'items-start' : a === 'right' ? 'items-end' : 'items-center'
}

export interface ImageWidthAttrs {
  widthPreset?: unknown
  size?: { width?: unknown } | null
}

export interface ResolvedImageWidth {
  /** 'preset' when a percentage preset is set, 'legacy' for the old pixel width */
  mode: 'preset' | 'legacy'
  preset: ImageWidthPreset | null
  /** CSS width of the image frame: "50%" or "300px" */
  widthCss: string
}

export function resolveImageWidth(attrs: ImageWidthAttrs | null | undefined): ResolvedImageWidth {
  const preset = normalizeWidthPreset(attrs?.widthPreset)
  if (preset) return { mode: 'preset', preset, widthCss: `${preset}%` }

  const px = Number(attrs?.size?.width)
  const width = Number.isFinite(px) && px > 0 ? px : LEGACY_IMAGE_WIDTH_PX
  return { mode: 'legacy', preset: null, widthCss: `${width}px` }
}

/**
 * Inline style for the frame that wraps the <img>. `maxWidth: 100%` guarantees
 * an image can never exceed the content column (no horizontal scroll), and the
 * image itself is `height: auto` so its aspect ratio is never distorted.
 */
export function imageFrameStyle(attrs: ImageWidthAttrs | null | undefined): {
  width: string
  maxWidth: '100%'
} {
  return { width: resolveImageWidth(attrs).widthCss, maxWidth: '100%' }
}

export function resolveImageAlt(attrs: { alt?: unknown } | null | undefined): string {
  return typeof attrs?.alt === 'string' ? attrs.alt : ''
}
