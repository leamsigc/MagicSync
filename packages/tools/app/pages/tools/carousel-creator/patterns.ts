export interface PatternDef {
  key: string
  css: (color: string) => string
}

export const CAROUSEL_PATTERNS: PatternDef[] = [
  { key: 'none', css: () => 'none' },
  {
    key: 'dots',
    css: c => `radial-gradient(${c} 1.5px, transparent 1.5px)`,
  },
  {
    key: 'dots-dense',
    css: c => `radial-gradient(${c} 1px, transparent 1px)`,
  },
  {
    key: 'grid',
    css: c => `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`,
  },
  {
    key: 'grid-fine',
    css: c => `linear-gradient(${c} 0.5px, transparent 0.5px), linear-gradient(90deg, ${c} 0.5px, transparent 0.5px)`,
  },
  {
    key: 'diagonal',
    css: c => `repeating-linear-gradient(45deg, ${c} 0 2px, transparent 2px 14px)`,
  },
  {
    key: 'diagonal-wide',
    css: c => `repeating-linear-gradient(-45deg, ${c} 0 3px, transparent 3px 24px)`,
  },
  {
    key: 'crosshatch',
    css: c => `repeating-linear-gradient(45deg, ${c} 0 1px, transparent 1px 10px), repeating-linear-gradient(-45deg, ${c} 0 1px, transparent 1px 10px)`,
  },
  {
    key: 'waves',
    css: c => `repeating-radial-gradient(circle at 50% 120%, ${c} 0 1px, transparent 1px 26px)`,
  },
  {
    key: 'rings',
    css: c => `repeating-radial-gradient(circle at 50% 50%, ${c} 0 1.5px, transparent 1.5px 30px)`,
  },
  {
    key: 'zigzag',
    css: c => `repeating-linear-gradient(135deg, ${c} 0 2px, transparent 2px 12px), repeating-linear-gradient(45deg, ${c} 0 2px, transparent 2px 12px)`,
  },
  {
    key: 'checker',
    css: c => `conic-gradient(${c} 90deg, transparent 90deg 180deg, ${c} 180deg 270deg, transparent 270deg)`,
  },
  {
    key: 'blueprint',
    css: c => `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px), linear-gradient(${c} 0.5px, transparent 0.5px), linear-gradient(90deg, ${c} 0.5px, transparent 0.5px)`,
  },
  {
    key: 'halftone',
    css: c => `radial-gradient(${c} 30%, transparent 31%)`,
  },
  {
    key: 'confetti',
    css: c => `radial-gradient(${c} 2px, transparent 2px), radial-gradient(${c} 2px, transparent 2px), radial-gradient(${c} 1.5px, transparent 1.5px)`,
  },
]

export const PATTERN_SIZES: Record<string, string> = {
  none: 'auto',
  dots: '22px 22px',
  'dots-dense': '12px 12px',
  grid: '44px 44px',
  'grid-fine': '20px 20px',
  diagonal: 'auto',
  'diagonal-wide': 'auto',
  crosshatch: 'auto',
  waves: 'auto',
  rings: 'auto',
  zigzag: 'auto',
  checker: '36px 36px',
  blueprint: '60px 60px, 60px 60px, 12px 12px, 12px 12px',
  halftone: '14px 14px',
  confetti: '60px 60px, 40px 40px, 50px 50px',
}

export const PATTERN_POSITIONS: Record<string, string> = {
  confetti: '0 0, 20px 30px, 35px 10px',
  halftone: '0 0',
}

export function patternBackground(key: string, color: string): string {
  const def = CAROUSEL_PATTERNS.find(p => p.key === key)
  if (!def || key === 'none') return 'none'
  return def.css(color)
}

export function patternStyle(key: string, color: string, opacity = 0.08): Record<string, string> {
  if (key === 'none') return {}
  return {
    backgroundImage: patternBackground(key, color),
    backgroundSize: PATTERN_SIZES[key] ?? 'auto',
    backgroundPosition: PATTERN_POSITIONS[key] ?? '0 0',
    opacity: String(opacity),
  }
}
