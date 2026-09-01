import type { GradientSpec } from './layers/types'

/**
 * Design asset libraries — postspark-style catalogs that instantiate as layers:
 * Frames, Backdrops, Overlays, Effects. Patterns live in `../patterns.ts`.
 */

export interface DesignPreset {
  key: string
  label: string
  /** Preview swatch CSS (small square) */
  thumb: string
}

// ── Frames ────────────────────────────────────────────────────────────────

export interface FramePreset extends DesignPreset {
  /** Full-bleed overlay div CSS. `{color}` / `{color2}` are replaced. */
  css: (color: string, color2: string, thickness: number) => string
}

export const FRAMES: FramePreset[] = [
  { key: 'none', label: 'None', thumb: '', css: () => '' },
  {
    key: 'rounded',
    label: 'Rounded',
    thumb: 'border-radius:30% 30% 30% 30%;border:4px solid #fff;background:transparent',
    css: c => `border-radius:52px;border:3px solid ${c};box-shadow:inset 0 0 0 2px rgba(0,0,0,0.25)`,
  },
  {
    key: 'minimal-thin',
    label: 'Thin line',
    thumb: 'border:2px solid #fff;border-radius:12px',
    css: (c, _c2, t) => `border:${Math.max(1, t)}px solid ${c};border-radius:12px`,
  },
  {
    key: 'thick',
    label: 'Thick border',
    thumb: 'border:8px solid #fff',
    css: (c, _c2, t) => `border:${Math.max(2, t)}px solid ${c}`,
  },
  {
    key: 'dotted',
    label: 'Dotted',
    thumb: 'border:4px dotted #fff',
    css: (c, _c2, t) => `border:${Math.max(2, t)}px dotted ${c}`,
  },
  {
    key: 'double',
    label: 'Double line',
    thumb: 'border:6px double #fff',
    css: (c, _c2, t) => `border:${Math.max(4, t)}px double ${c}`,
  },
  {
    key: 'gradient-ring',
    label: 'Gradient ring',
    thumb: 'background:linear-gradient(90deg,#f59e0b,#ef4444)',
    css: (c, c2) => `border:14px solid transparent;background:linear-gradient(#000,#000) padding-box,linear-gradient(135deg,${c},${c2}) border-box;border-radius:24px`,
  },
  {
    key: 'neon',
    label: 'Neon glow',
    thumb: 'border:4px solid #22d3ee;box-shadow:0 0 12px #22d3ee',
    css: c => `border:6px solid ${c};box-shadow:0 0 28px ${c}, inset 0 0 28px ${c};border-radius:20px`,
  },
  {
    key: 'polaroid',
    label: 'Polaroid',
    thumb: 'border:12px solid #fff;box-shadow:0 6px 14px rgba(0,0,0,.4)',
    css: (c, _c2, t) => `border:${Math.max(10, t)}px solid ${c};box-shadow:0 28px 60px rgba(0,0,0,0.35)`,
  },
  {
    key: 'arch',
    label: 'Arch',
    thumb: 'border:4px solid #fff;border-radius:50% 50% 0 0 / 22% 22% 0 0',
    css: c => `border:12px solid ${c};border-radius:50% 50% 0 0 / 24% 24% 0 0`,
  },
  {
    key: 'gold',
    label: 'Gold luxe',
    thumb: 'border:3px solid #d4af37;box-shadow:0 0 10px #d4af37',
    css: c => `border:3px solid ${c};box-shadow:inset 0 0 0 10px rgba(0,0,0,0.12), inset 0 0 0 13px ${c}, 0 0 18px ${c};border-radius:10px`,
  },
  {
    key: 'shadow-frame',
    label: 'Soft shadow',
    thumb: 'box-shadow:0 10px 24px rgba(0,0,0,.5);border-radius:16px',
    css: () => `border-radius:16px;box-shadow:0 0 0 3px rgba(255,255,255,0.14), 0 34px 80px rgba(0,0,0,0.5)`,
  },
]

// ── Backdrops ─────────────────────────────────────────────────────────────

export interface BackdropPreset extends DesignPreset {
  /** CSS background value for previews. `{color}`/`{color2}` substituted where present. */
  css: (color?: string, color2?: string) => string
  /** Structured gradient (editable in the style panel) — preferred over `css`. */
  gradient?: GradientSpec
  /** Texture as a data-URI image fill. */
  image?: string
}

export const BACKDROP_GRADIENTS: BackdropPreset[] = [
  { key: 'sunset', label: 'Sunset', thumb: 'background:linear-gradient(135deg,#f97316,#ec4899)', css: () => 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)', gradient: { kind: 'linear', angle: 135, stops: [{ color: '#f97316', pos: 0 }, { color: '#ec4899', pos: 100 }] } },
  { key: 'ocean', label: 'Ocean', thumb: 'background:linear-gradient(135deg,#0ea5e9,#6366f1)', css: () => 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)', gradient: { kind: 'linear', angle: 135, stops: [{ color: '#0ea5e9', pos: 0 }, { color: '#6366f1', pos: 100 }] } },
  { key: 'forest', label: 'Forest', thumb: 'background:linear-gradient(160deg,#065f46,#4ade80)', css: () => 'linear-gradient(160deg, #065f46 0%, #4ade80 100%)', gradient: { kind: 'linear', angle: 160, stops: [{ color: '#065f46', pos: 0 }, { color: '#4ade80', pos: 100 }] } },
  { key: 'grape', label: 'Grape', thumb: 'background:linear-gradient(135deg,#7c3aed,#c084fc)', css: () => 'linear-gradient(135deg, #7c3aed 0%, #c084fc 100%)', gradient: { kind: 'linear', angle: 135, stops: [{ color: '#7c3aed', pos: 0 }, { color: '#c084fc', pos: 100 }] } },
  { key: 'ember', label: 'Ember', thumb: 'background:linear-gradient(135deg,#dc2626,#fbbf24)', css: () => 'linear-gradient(135deg, #dc2626 0%, #fbbf24 100%)', gradient: { kind: 'linear', angle: 135, stops: [{ color: '#dc2626', pos: 0 }, { color: '#fbbf24', pos: 100 }] } },
  { key: 'aurora', label: 'Aurora', thumb: 'background:linear-gradient(135deg,#06b6d4,#10b981)', css: () => 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)', gradient: { kind: 'linear', angle: 135, stops: [{ color: '#06b6d4', pos: 0 }, { color: '#10b981', pos: 100 }] } },
  { key: 'cyber', label: 'Cyber', thumb: 'background:linear-gradient(135deg,#0f172a,#22d3ee)', css: () => 'linear-gradient(135deg, #0f172a 0%, #22d3ee 100%)', gradient: { kind: 'linear', angle: 135, stops: [{ color: '#0f172a', pos: 0 }, { color: '#22d3ee', pos: 100 }] } },
  { key: 'mint', label: 'Mint', thumb: 'background:linear-gradient(160deg,#ecfdf5,#99f6e4)', css: () => 'linear-gradient(160deg, #ecfdf5 0%, #99f6e4 100%)', gradient: { kind: 'linear', angle: 160, stops: [{ color: '#ecfdf5', pos: 0 }, { color: '#99f6e4', pos: 100 }] } },
  { key: 'gold', label: 'Gold', thumb: 'background:linear-gradient(135deg,#451a03,#d4af37)', css: () => 'linear-gradient(135deg, #451a03 0%, #d4af37 100%)', gradient: { kind: 'linear', angle: 135, stops: [{ color: '#451a03', pos: 0 }, { color: '#d4af37', pos: 100 }] } },
  { key: 'sky', label: 'Sky', thumb: 'background:linear-gradient(180deg,#38bdf8,#e0f2fe)', css: () => 'linear-gradient(180deg, #38bdf8 0%, #e0f2fe 100%)', gradient: { kind: 'linear', angle: 180, stops: [{ color: '#38bdf8', pos: 0 }, { color: '#e0f2fe', pos: 100 }] } },
  { key: 'blush', label: 'Blush', thumb: 'background:linear-gradient(135deg,#fdf2f8,#f9a8d4)', css: () => 'linear-gradient(135deg, #fdf2f8 0%, #f9a8d4 100%)', gradient: { kind: 'linear', angle: 135, stops: [{ color: '#fdf2f8', pos: 0 }, { color: '#f9a8d4', pos: 100 }] } },
  { key: 'desert', label: 'Desert', thumb: 'background:linear-gradient(135deg,#fde68a,#ea580c)', css: () => 'linear-gradient(135deg, #fde68a 0%, #ea580c 100%)', gradient: { kind: 'linear', angle: 135, stops: [{ color: '#fde68a', pos: 0 }, { color: '#ea580c', pos: 100 }] } },
  { key: 'midnight', label: 'Midnight', thumb: 'background:linear-gradient(135deg,#0f0e0d,#44403c)', css: () => 'linear-gradient(135deg, #0f0e0d 0%, #44403c 100%)', gradient: { kind: 'linear', angle: 135, stops: [{ color: '#0f0e0d', pos: 0 }, { color: '#44403c', pos: 100 }] } },
  { key: 'mono-light', label: 'Mono light', thumb: 'background:linear-gradient(135deg,#fafaf9,#e7e5e4)', css: () => 'linear-gradient(135deg, #fafaf9 0%, #e7e5e4 100%)', gradient: { kind: 'linear', angle: 135, stops: [{ color: '#fafaf9', pos: 0 }, { color: '#e7e5e4', pos: 100 }] } },
  { key: 'sunburst', label: 'Sunburst', thumb: 'background:radial-gradient(circle at 30% 30%,#fef08a,#f97316)', css: () => 'radial-gradient(circle at 30% 30%, #fef08a 0%, #f97316 100%)', gradient: { kind: 'radial', angle: 0, stops: [{ color: '#fef08a', pos: 0 }, { color: '#f97316', pos: 100 }] } },
  { key: 'moonlight', label: 'Moonlight', thumb: 'background:radial-gradient(circle at 70% 20%,#38bdf8,#0c1e35)', css: () => 'radial-gradient(circle at 70% 20%, #38bdf8 0%, #0c1e35 100%)', gradient: { kind: 'radial', angle: 0, stops: [{ color: '#38bdf8', pos: 0 }, { color: '#0c1e35', pos: 100 }] } },
  { key: 'neon-conic', label: 'Neon conic', thumb: 'background:conic-gradient(#f472b6,#a78bfa,#22d3ee,#f472b6)', css: () => 'conic-gradient(from 210deg, #f472b6 0%, #a78bfa 40%, #22d3ee 70%, #f472b6 100%)', gradient: { kind: 'conic', angle: 210, stops: [{ color: '#f472b6', pos: 0 }, { color: '#a78bfa', pos: 40 }, { color: '#22d3ee', pos: 70 }, { color: '#f472b6', pos: 100 }] } },
  { key: 'pastel-conic', label: 'Pastel conic', thumb: 'background:conic-gradient(#fbcfe8,#c7d2fe,#a7f3d0,#fbcfe8)', css: () => 'conic-gradient(from 180deg, #fbcfe8 0%, #c7d2fe 45%, #a7f3d0 75%, #fbcfe8 100%)', gradient: { kind: 'conic', angle: 180, stops: [{ color: '#fbcfe8', pos: 0 }, { color: '#c7d2fe', pos: 45 }, { color: '#a7f3d0', pos: 75 }, { color: '#fbcfe8', pos: 100 }] } },
]

const NOISE_URI = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.5'/></svg>\")"

export const BACKDROP_TEXTURES: BackdropPreset[] = [
  { key: 'noise', label: 'Noise', thumb: NOISE_URI, css: () => NOISE_URI, image: NOISE_URI },
  {
    key: 'paper',
    label: 'Paper',
    thumb: 'background:#fafaf7;background-image:radial-gradient(#d6d3d1 0.8px,transparent 0.8px);background-size:16px 16px',
    css: (c) => `radial-gradient(${c ?? '#d6d3d1'} 0.8px, transparent 0.8px)`,
    gradient: { kind: 'linear', angle: 0, stops: [{ color: '#fafaf7', pos: 0 }, { color: '#fafaf7', pos: 100 }] },
  },
  {
    key: 'grain',
    label: 'Grain',
    thumb: 'background:#111;background-image:radial-gradient(#444 0.6px,transparent 0.6px);background-size:7px 7px',
    css: (c) => `radial-gradient(${c ?? '#3f3f46'} 0.6px, transparent 0.6px)`,
    gradient: { kind: 'linear', angle: 0, stops: [{ color: '#171717', pos: 0 }, { color: '#171717', pos: 100 }] },
  },
]

// ── Overlays ──────────────────────────────────────────────────────────────

export interface OverlayPreset extends DesignPreset {
  css: (color: string) => string
}

export const OVERLAYS: OverlayPreset[] = [
  { key: 'none', label: 'None', thumb: '', css: () => '' },
  { key: 'vignette', label: 'Vignette', thumb: 'background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55) 100%)', css: () => 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)' },
  { key: 'scrim-top', label: 'Scrim top', thumb: 'background:linear-gradient(to bottom,rgba(0,0,0,.6),transparent 45%)', css: () => 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 45%)' },
  { key: 'scrim-bottom', label: 'Scrim bottom', thumb: 'background:linear-gradient(to top,rgba(0,0,0,.6),transparent 45%)', css: () => 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 45%)' },
  { key: 'scrim-left', label: 'Scrim left', thumb: 'background:linear-gradient(to right,rgba(0,0,0,.5),transparent 40%)', css: () => 'linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 40%)' },
  { key: 'scrim-right', label: 'Scrim right', thumb: 'background:linear-gradient(to left,rgba(0,0,0,.5),transparent 40%)', css: () => 'linear-gradient(to left, rgba(0,0,0,0.5) 0%, transparent 40%)' },
  {
    key: 'noise',
    label: 'Noise grain',
    thumb: 'background:url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.6%22/></svg>")',
    css: () => `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.5'/></svg>")`,
  },
  { key: 'grid-lines', label: 'Grid lines', thumb: 'background:repeating-linear-gradient(0deg,transparent,transparent 9px,rgba(255,255,255,.25) 9px,rgba(255,255,255,.25) 10px)', css: (c) => `repeating-linear-gradient(0deg, transparent, transparent 47px, ${c} 47px, ${c} 48px), repeating-linear-gradient(90deg, transparent, transparent 47px, ${c} 47px, ${c} 48px)` },
  { key: 'light-leak', label: 'Light leak', thumb: 'background:linear-gradient(115deg,transparent 30%,rgba(255,183,77,.35) 45%,transparent 60%),radial-gradient(circle at 80% 20%,rgba(255,255,255,.25),transparent 40%)', css: () => `linear-gradient(115deg, transparent 30%, rgba(255,183,77,0.35) 45%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.25) 0%, transparent 40%)` },
  { key: 'soft-edge', label: 'Soft edges', thumb: 'box-shadow:inset 0 0 60px rgba(0,0,0,.6)', css: () => 'box-shadow: inset 0 0 90px rgba(0,0,0,0.55), inset 0 0 200px rgba(0,0,0,0.15)' },
  { key: 'tint', label: 'Color tint', thumb: 'background:rgba(249,115,22,.35)', css: (c) => `${c}66` },
]

// ── Effects ───────────────────────────────────────────────────────────────

export interface EffectPreset extends DesignPreset {
  /** Filter applied to the slide content wrapper */
  filter: string
  /** Blend overlays painted over content (duotone etc.) */
  overlays: Array<{ color: string, blend: 'multiply' | 'screen' | 'overlay', opacity: number }>
}

export const EFFECTS: EffectPreset[] = [
  { key: 'none', label: 'None', thumb: '', filter: '', overlays: [] },
  { key: 'warm', label: 'Warm', thumb: 'filter:sepia(.3) saturate(1.25)', filter: 'sepia(0.3) saturate(1.25)', overlays: [] },
  { key: 'cool', label: 'Cool', thumb: 'filter:saturate(1.25) hue-rotate(-8deg)', filter: 'saturate(1.25) hue-rotate(-8deg) brightness(1.04)', overlays: [] },
  { key: 'bw', label: 'B&W', thumb: 'filter:grayscale(1)', filter: 'grayscale(1) contrast(1.05)', overlays: [] },
  { key: 'contrast', label: 'Contrast', thumb: 'filter:contrast(1.3) saturate(1.15)', filter: 'contrast(1.3) saturate(1.15)', overlays: [] },
  { key: 'soft', label: 'Soft focus', thumb: 'filter:blur(2px) brightness(1.06)', filter: 'blur(1.5px) brightness(1.06)', overlays: [] },
  { key: 'duotone-ember', label: 'Duotone ember', thumb: 'filter:grayscale(1) contrast(1.3)', filter: 'grayscale(1) contrast(1.35)', overlays: [{ color: '#f97316', blend: 'multiply', opacity: 1 }, { color: '#1c1917', blend: 'screen', opacity: 0.9 }] },
  { key: 'duotone-ocean', label: 'Duotone ocean', thumb: 'filter:grayscale(1) contrast(1.3)', filter: 'grayscale(1) contrast(1.35)', overlays: [{ color: '#0891b2', blend: 'multiply', opacity: 1 }, { color: '#f0f9ff', blend: 'screen', opacity: 0.85 }] },
  { key: 'duotone-purple', label: 'Duotone purple', thumb: 'filter:grayscale(1) contrast(1.3)', filter: 'grayscale(1) contrast(1.35)', overlays: [{ color: '#7c3aed', blend: 'multiply', opacity: 1 }, { color: '#fdf4ff', blend: 'screen', opacity: 0.85 }] },
]

export function effectPreset(key: string): EffectPreset {
  return EFFECTS.find(e => e.key === key) ?? EFFECTS[0]!
}

export function framePreset(key: string): FramePreset {
  return FRAMES.find(f => f.key === key) ?? FRAMES[0]!
}

export function overlayPreset(key: string): OverlayPreset {
  return OVERLAYS.find(o => o.key === key) ?? OVERLAYS[0]!
}