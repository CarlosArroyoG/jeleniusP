import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  IMAGE_WIDTH_PRESETS,
  LEGACY_IMAGE_WIDTH_PX,
  alignmentItemsClass,
  imageFrameStyle,
  normalizeAlignment,
  normalizeWidthPreset,
  resolveImageAlt,
  resolveImageWidth,
} from '../lib/imageBlock.ts'

const webRoot = path.resolve(import.meta.dirname, '..')
const read = (rel) => fs.readFileSync(path.join(webRoot, rel), 'utf8')

describe('presets', () => {
  test('exactly four presets: 25 / 50 / 75 / 100', () => {
    expect([...IMAGE_WIDTH_PRESETS]).toEqual(['25', '50', '75', '100'])
  })

  test.each([
    ['25', '25%'],
    ['50', '50%'],
    ['75', '75%'],
    ['100', '100%'],
  ])('preset %s renders a %s wide frame, capped at 100% of the content', (preset, css) => {
    const style = imageFrameStyle({ widthPreset: preset })
    expect(style.width).toBe(css)
    expect(style.maxWidth).toBe('100%')
    const resolved = resolveImageWidth({ widthPreset: preset })
    expect(resolved.mode).toBe('preset')
    expect(resolved.preset).toBe(preset)
  })

  test('full width is 100% of the usable content width, never a viewport unit', () => {
    const style = imageFrameStyle({ widthPreset: '100' })
    expect(style.width).toBe('100%')
    expect(JSON.stringify(style)).not.toMatch(/vw/)
  })

  test('numeric and percent-suffixed values are accepted', () => {
    expect(normalizeWidthPreset(50)).toBe('50')
    expect(normalizeWidthPreset('75%')).toBe('75')
    expect(normalizeWidthPreset(' 25 ')).toBe('25')
  })

  test('invalid presets are ignored instead of producing a broken width', () => {
    expect(normalizeWidthPreset('33')).toBeNull()
    expect(normalizeWidthPreset('abc')).toBeNull()
    expect(normalizeWidthPreset('')).toBeNull()
    expect(normalizeWidthPreset(null)).toBeNull()
    expect(normalizeWidthPreset(undefined)).toBeNull()
    expect(resolveImageWidth({ widthPreset: '33', size: { width: 420 } }).widthCss).toBe('420px')
  })
})

describe('width fallback and old content (backward compatibility)', () => {
  test('an old image with only size.width keeps that exact pixel width', () => {
    const r = resolveImageWidth({ size: { width: 640 } })
    expect(r).toEqual({ mode: 'legacy', preset: null, widthCss: '640px' })
    expect(imageFrameStyle({ size: { width: 640 } })).toEqual({ width: '640px', maxWidth: '100%' })
  })

  test('an old image with no size at all falls back to the historical 300px', () => {
    expect(LEGACY_IMAGE_WIDTH_PX).toBe(300)
    expect(resolveImageWidth({}).widthCss).toBe('300px')
    expect(resolveImageWidth(null).widthCss).toBe('300px')
    expect(resolveImageWidth(undefined).widthCss).toBe('300px')
    expect(resolveImageWidth({ size: null }).widthCss).toBe('300px')
  })

  test('garbage sizes fall back instead of rendering NaNpx / 0px', () => {
    expect(resolveImageWidth({ size: { width: 'wide' } }).widthCss).toBe('300px')
    expect(resolveImageWidth({ size: { width: 0 } }).widthCss).toBe('300px')
    expect(resolveImageWidth({ size: { width: -20 } }).widthCss).toBe('300px')
    expect(resolveImageWidth({ size: {} }).widthCss).toBe('300px')
  })

  test('a preset wins over the stored pixel width (an explicit choice supersedes the drag)', () => {
    expect(resolveImageWidth({ widthPreset: '50', size: { width: 900 } }).widthCss).toBe('50%')
  })

  test('clearing the preset (widthPreset null) restores the pixel width', () => {
    expect(resolveImageWidth({ widthPreset: null, size: { width: 480 } }).widthCss).toBe('480px')
  })
})

describe('alignment', () => {
  test('left / center / right map to flex alignment classes', () => {
    expect(alignmentItemsClass('left')).toBe('items-start')
    expect(alignmentItemsClass('center')).toBe('items-center')
    expect(alignmentItemsClass('right')).toBe('items-end')
  })

  test('missing or unknown alignment (old images) defaults to center', () => {
    expect(normalizeAlignment(undefined)).toBe('center')
    expect(normalizeAlignment(null)).toBe('center')
    expect(normalizeAlignment('justify')).toBe('center')
    expect(alignmentItemsClass(undefined)).toBe('items-center')
  })
})

describe('alt text', () => {
  test('returns the stored alt, or an empty string for old images', () => {
    expect(resolveImageAlt({ alt: 'Docente en clase' })).toBe('Docente en clase')
    expect(resolveImageAlt({})).toBe('')
    expect(resolveImageAlt(null)).toBe('')
    expect(resolveImageAlt({ alt: 42 })).toBe('')
  })
})

describe('editor + learner use the same attributes (source-level guards)', () => {
  const component = read('components/Objects/Editor/Extensions/Image/ImageBlockComponent.tsx')
  const extension = read('components/Objects/Editor/Extensions/Image/ImageBlock.ts')
  const css = read('styles/globals.css')

  test('the node declares the new attributes with backward-compatible defaults', () => {
    expect(extension).toMatch(/widthPreset:\s*\{\s*default:\s*null/)
    expect(extension).toMatch(/alt:\s*\{\s*default:\s*''/)
    // legacy attributes are still declared
    expect(extension).toContain('size:')
    expect(extension).toContain('alignment:')
  })

  test('one NodeView renders both modes and resolves width through the shared helper', () => {
    expect(component).toContain("from '@/lib/imageBlock'")
    expect(component).toContain('resolveImageWidth(')
    expect(component).toContain('imageFrameStyle(')
    // the learner (non-editable) frame uses the same computed style
    expect(component).toContain('const viewFrameStyle: React.CSSProperties = frameStyle')
  })

  test('the editor exposes the four presets and the alignment controls', () => {
    expect(component).toContain('IMAGE_WIDTH_PRESETS.map')
    expect(component).toContain('data-testid={`image-size-${preset}`}')
    for (const a of ['left', 'center', 'right']) {
      expect(component).toContain(`data-testid="image-align-${a}"`)
    }
  })

  test('the image is never forced to a height (aspect ratio preserved) or to a viewport width', () => {
    expect(component).toContain('h-auto')
    expect(component).not.toMatch(/\b100vw\b/)
    expect(component).not.toMatch(/object-cover/)
  })

  test('dragging to a custom pixel width drops the preset so both stay consistent', () => {
    expect(component).toMatch(/widthPreset:\s*null/)
  })

  test('narrow screens: presets collapse to full content width via CSS', () => {
    expect(css).toMatch(/@media \(max-width: 639px\)\s*\{\s*\.lh-image-frame\[data-image-preset\]\s*\{\s*width:\s*100%\s*!important/)
  })
})
