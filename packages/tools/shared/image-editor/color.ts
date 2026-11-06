/**
 * Color parsing/formatting shared by every studio color control.
 *
 * Fabric accepts hex, rgb()/rgba() and named colors. The picker needs an
 * RGB hex plus a separate 0-1 alpha so a single slider can drive opacity for
 * solid fills and gradient stops alike.
 */

export interface ParsedColor {
  /** Opaque `#rrggbb` value. */
  hex: string
  /** 0 (transparent) … 1 (opaque). */
  alpha: number
}

const clampAlpha = (value: number): number => Math.min(1, Math.max(0, value))

function expandHex(value: string): string | null {
  const hex = value.replace('#', '')
  if (!/^[0-9a-f]+$/i.test(hex)) return null
  if (hex.length === 3 || hex.length === 4) {
    const [r, g, b, a] = hex.split('')
    return `#${r}${r}${g}${g}${b}${b}${a ?? ''}${a ?? ''}`
  }
  if (hex.length === 6 || hex.length === 8) return `#${hex}`
  return null
}

/** Named CSS colors → `#rrggbb` (canvas is the cheapest parser available). */
function namedToHex(value: string): string | null {
  if (typeof document === 'undefined') return null
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return null
  context.fillStyle = '#000000'
  context.fillStyle = value
  const resolved = String(context.fillStyle)
  return resolved.startsWith('#') ? resolved : null
}

function parseHex(value: string): ParsedColor | null {
  const expanded = expandHex(value)
  if (!expanded) return null
  const alpha = expanded.length === 9 ? parseInt(expanded.slice(7, 9), 16) / 255 : 1
  return { hex: expanded.slice(0, 7).toLowerCase(), alpha: clampAlpha(alpha) }
}

function parseRgb(value: string): ParsedColor | null {
  const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(value)
  if (!match) return null
  const channel = (raw: string) => Math.min(255, Math.max(0, Math.round(Number(raw))))
  const hex = `#${[match[1], match[2], match[3]].map(raw => channel(raw).toString(16).padStart(2, '0')).join('')}`
  const rawAlpha = match[4]
  const alpha = rawAlpha === undefined
    ? 1
    : rawAlpha.endsWith('%') ? Number(rawAlpha.slice(0, -1)) / 100 : Number(rawAlpha)
  return { hex, alpha: clampAlpha(Number.isFinite(alpha) ? alpha : 1) }
}

export function parseColor(input: string | undefined | null): ParsedColor {
  const raw = String(input ?? '').trim()
  if (raw === '') return { hex: '#000000', alpha: 1 }
  if (raw.toLowerCase() === 'transparent') return { hex: '#000000', alpha: 0 }

  const hex = raw.startsWith('#') ? parseHex(raw) : null
  if (hex) return hex
  const rgb = parseRgb(raw)
  if (rgb) return rgb
  const named = namedToHex(raw)
  return named ? { hex: named, alpha: 1 } : { hex: '#000000', alpha: 1 }
}

export function formatColor(hex: string, alpha: number): string {
  const parsed = parseColor(hex)
  const safeAlpha = clampAlpha(alpha)
  if (safeAlpha >= 0.999) return parsed.hex
  const value = Number.parseInt(parsed.hex.slice(1), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${Number(safeAlpha.toFixed(3))})`
}
