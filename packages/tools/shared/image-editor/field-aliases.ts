import { FIELD_SUFFIXES, type FieldSuffix } from './document'

/**
 * Cross-version alias tables and predicate helpers shared by the
 * normalizer, the field binder and the Variables panel.
 */

/** linkData/linkObject property names → canonical FieldSuffix. */
export const EDITOR_FIELD_ALIASES: Record<string, FieldSuffix> = {
  text: 'text',
  content: 'text',
  label: 'text',
  tittle: 'text',
  title: 'text',
  src: 'image_url',
  url: 'image_url',
  image: 'image_url',
  video: 'video_url',
  fill: 'color',
  color: 'color',
  font: 'font_family',
  fontFamily: 'font_family',
  fontSize: 'font_size',
  fontSizeValue: 'font_size',
  visible: 'visible',
  show: 'visible',
  hidden: 'visible',
}

/** Known CJK / alias font mapping (source family → bundled family). */
export const FONT_ALIASES: Record<string, string> = {
  '站酷快乐体': 'ZCOOL KuaiLe',
  '站酷高端黑': 'Noto Sans SC',
  '思源黑体': 'Noto Sans SC',
  'Noto Sans SC': 'Noto Sans SC',
}

/** Filter types fabric 7.4 still ships. Others are dropped with a warning. */
export const V7_FILTER_TYPES = new Set([
  'BlendColor', 'Blur', 'Brightness', 'ColorMatrix', 'Composed', 'Contrast',
  'Convolute', 'Gamma', 'Grayscale', 'HueRotation', 'Invert', 'Noise',
  'Pixelate', 'RemoveColor', 'Saturation', 'Sepia', 'Vibrance',
])

export const EASINGS = [
  'linear', 'easeInSine', 'easeOutSine', 'easeInOutSine', 'easeInQuad', 'easeOutQuad',
  'easeInOutQuad', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic', 'easeInQuart',
  'easeOutQuart', 'easeInOutQuart', 'easeInExpo', 'easeOutExpo', 'easeInOutExpo',
] as const

export function isFieldSuffix(value: unknown): value is FieldSuffix {
  return typeof value === 'string' && (FIELD_SUFFIXES as readonly string[]).includes(value)
}

export function aliasSuffix(value: unknown): FieldSuffix | null {
  if (isFieldSuffix(value)) return value
  const key = String(value ?? '')
  return EDITOR_FIELD_ALIASES[key] ?? null
}

export function inferSuffixForObject(obj: Record<string, unknown>): FieldSuffix {
  const type = String(obj.type ?? '').toLowerCase()
  if (type === 'image') return 'image_url'
  if (type === 'textbox' || type === 'i-text' || type === 'itext' || type === 'text') return 'text'
  return 'visible'
}
