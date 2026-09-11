/**
 * Presets mapping the 28 legacy HTML carousel templates onto the generic
 * auto-layout converter (`html-convert.ts`).
 *
 * Sizes/alignments were harvested from the bespoke `render()` functions in
 * `app/pages/tools/carousel-creator/templates.ts` so converted decks keep
 * their visual identity (content-complete, editable object layers).
 */
export type BlockKind =
  | 'accentBar'
  | 'kicker'
  | 'headline'
  | 'body'
  | 'quoteMark'
  | 'quote'
  | 'author'
  | 'stat'
  | 'statLabel'
  | 'items'
  | 'ctaButton'
  | 'avatar'

export type ItemStyle =
  | 'numbered'
  | 'bullet'
  | 'check'
  | 'steps'
  | 'timeline'
  | 'cards'
  | 'columns'
  | 'chips'
  | 'letter'
  | 'dot'

export type ImageRegion =
  | 'leftPanel'
  | 'fullBleed'
  | 'polaroid'
  | 'grid2x2'
  | 'wall'
  | 'focusTop'
  | 'avatarCircle'

export type DecorationKind =
  | 'splitBand'
  | 'duotoneBand'
  | 'terminalDots'
  | 'wireRings'

export interface LegacyPreset {
  align: 'left' | 'center'
  headlineSize: number
  bodySize: number
  blocks: BlockKind[]
  itemStyle?: ItemStyle
  maxItems?: number
  imageRegion?: ImageRegion
  decoration?: DecorationKind
  kickerSize?: number
  /** Giant-number size for stat/number-hero/duotone templates. */
  statSize?: number
  /** Full-bleed photo templates render text in white. */
  textColor?: string
  /** Duotone band: kicker + stat paint in bg color (they sit on accent). */
  bandText?: boolean
}

const LEFT: Array<BlockKind> = ['accentBar', 'kicker', 'headline', 'body']

export const LEGACY_PRESETS: Record<string, LegacyPreset> = {
  'title-kicker': { align: 'left', headlineSize: 96, bodySize: 34, blocks: [...LEFT] },
  'big-statement': { align: 'left', headlineSize: 104, bodySize: 30, blocks: ['headline', 'body'] },
  'tips-list': { align: 'left', headlineSize: 58, bodySize: 30, blocks: ['kicker', 'headline', 'items'], itemStyle: 'numbered' },
  'quote': { align: 'center', headlineSize: 60, bodySize: 28, blocks: ['quoteMark', 'quote', 'author'] },
  'stat-highlight': { align: 'center', headlineSize: 40, bodySize: 28, blocks: ['stat', 'statLabel', 'body'], statSize: 220 },
  'steps': { align: 'left', headlineSize: 54, bodySize: 30, blocks: ['headline', 'items'], itemStyle: 'steps' },
  'checklist': { align: 'left', headlineSize: 56, bodySize: 30, blocks: ['headline', 'items'], itemStyle: 'check' },
  'comparison': { align: 'center', headlineSize: 52, bodySize: 27, blocks: ['headline', 'items'], itemStyle: 'columns' },
  'photo-left': { align: 'left', headlineSize: 64, bodySize: 30, blocks: ['accentBar', 'headline', 'body'], imageRegion: 'leftPanel' },
  'full-photo': { align: 'left', headlineSize: 84, bodySize: 32, blocks: ['kicker', 'headline', 'body'], imageRegion: 'fullBleed', textColor: '#ffffff', kickerSize: 24 },
  'qa': { align: 'left', headlineSize: 56, bodySize: 34, blocks: ['headline', 'body'] },
  'myth-fact': { align: 'left', headlineSize: 36, bodySize: 30, blocks: ['kicker', 'headline', 'items'], itemStyle: 'bullet' },
  'cta': { align: 'center', headlineSize: 88, bodySize: 32, blocks: ['accentBar', 'headline', 'body', 'ctaButton'] },
  'photo-grid': { align: 'left', headlineSize: 56, bodySize: 26, blocks: ['kicker', 'headline'], imageRegion: 'grid2x2' },
  'polaroid': { align: 'center', headlineSize: 32, bodySize: 30, blocks: ['headline', 'body'], imageRegion: 'polaroid' },
  'stat-cards': { align: 'left', headlineSize: 54, bodySize: 25, blocks: ['headline', 'items'], itemStyle: 'cards' },
  'split-band': { align: 'left', headlineSize: 92, bodySize: 38, blocks: ['kicker', 'headline', 'body'], decoration: 'splitBand' },
  'number-hero': { align: 'left', headlineSize: 64, bodySize: 30, blocks: ['stat', 'headline', 'body', 'items'], itemStyle: 'dot', maxItems: 3, statSize: 168 },
  'feature-highlight': { align: 'left', headlineSize: 54, bodySize: 26, blocks: ['kicker', 'headline', 'body', 'items'], itemStyle: 'chips', maxItems: 3 },
  'testimonial': { align: 'center', headlineSize: 48, bodySize: 22, blocks: ['avatar', 'quote', 'author', 'body'] },
  'timeline': { align: 'left', headlineSize: 52, bodySize: 26, blocks: ['headline', 'items', 'body'], itemStyle: 'timeline', maxItems: 5 },
  'image-focus': { align: 'left', headlineSize: 54, bodySize: 26, blocks: ['headline', 'body'], imageRegion: 'focusTop' },
  'wireframe-hero': { align: 'left', headlineSize: 112, bodySize: 30, blocks: ['kicker', 'headline', 'body'], decoration: 'wireRings', kickerSize: 20 },
  'terminal-window': { align: 'left', headlineSize: 62, bodySize: 28, blocks: ['kicker', 'headline', 'body'], decoration: 'terminalDots' },
  'gallery-wall': { align: 'left', headlineSize: 52, bodySize: 26, blocks: ['kicker', 'headline', 'body'], imageRegion: 'wall', kickerSize: 22 },
  'mono-statement': { align: 'center', headlineSize: 86, bodySize: 30, blocks: ['headline', 'body'] },
  'duotone-stat': { align: 'left', headlineSize: 52, bodySize: 26, blocks: ['kicker', 'stat', 'headline', 'statLabel', 'body'], decoration: 'duotoneBand', bandText: true, statSize: 190 },
  'clay-cards': { align: 'left', headlineSize: 56, bodySize: 26, blocks: ['kicker', 'headline', 'body', 'items'], itemStyle: 'letter', maxItems: 3 },
}

export const LEGACY_TEMPLATE_KEYS = Object.keys(LEGACY_PRESETS)

export const DEFAULT_PRESET: LegacyPreset = {
  align: 'left',
  headlineSize: 64,
  bodySize: 30,
  blocks: ['kicker', 'headline', 'body', 'items'],
  itemStyle: 'bullet',
}

export function presetFor(templateKey: string): LegacyPreset {
  return LEGACY_PRESETS[templateKey] ?? DEFAULT_PRESET
}
