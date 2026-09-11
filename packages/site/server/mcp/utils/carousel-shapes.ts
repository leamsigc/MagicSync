import { z } from 'zod'

/**
 * Shared zod shapes for the carousel + menu-board MCP tools (Task 2).
 * Field coverage mirrors the editor's SlideData/MenuPage models so agents can
 * express any of the 40 carousel templates or any board page.
 */
export const carouselSlideInput = z.object({
  templateKey: z.string().describe('Layout: 22 legacy (title-kicker, quote, stat-highlight, tips-list, cta, comparison, ...) or 12 layer templates (layer-split-screen, layer-magazine, ...)'),
  headline: z.string().min(1).max(220).describe('Main headline text'),
  kicker: z.string().max(80).optional().describe('Short uppercase label above the headline'),
  body: z.string().max(500).optional().describe('Supporting paragraph, 2-4 sentences'),
  items: z.array(z.string().max(200)).max(8).optional().describe('List items for list/step/checklist/comparison layouts'),
  quote: z.string().max(300).optional().describe('Quote text for quote layouts'),
  author: z.string().max(80).optional().describe('Quote attribution'),
  stat: z.string().max(20).optional().describe('Big number for stat layouts, e.g. "87%"'),
  statLabel: z.string().max(150).optional().describe('Label under the stat number'),
  cta: z.string().max(50).optional().describe('Call-to-action button text'),
  footer: z.string().max(120).optional().describe('Small footer line'),
  images: z.array(z.string()).max(4).optional().describe('Image URLs for photo layouts (leave empty, attach later)'),
})

export const carouselPaletteInput = z.object({
  bg: z.string().default('#0f0e0d').describe('Slide background hex color'),
  text: z.string().default('#fafaf9').describe('Primary text hex color'),
  accent: z.string().default('#f97316').describe('Accent hex color for highlights and buttons'),
  font: z.string().optional().describe('Deck font family'),
})

export const menuBoardPageInput = z.object({
  id: z.string().optional().describe('Page ID (omit to auto-generate; pass back to keep identity across updates)'),
  name: z.string().min(1).max(200).describe('Page/tab name, e.g. "Mains"'),
  type: z.enum(['html', 'image']).describe('HTML menu markup or a single image URL'),
  content: z.string().max(500000).describe('Inline-styled HTML (16:9, large type) or image URL'),
  isActive: z.boolean().describe('Inactive pages are hidden from the public display'),
  order: z.number().int().min(0).describe('Display order, lowest first'),
})

export const menuBoardSettingsInput = z.object({
  transitionTime: z.number().int().min(1).max(3600).default(10).describe('Seconds each page shows on the TV'),
  unlockPin: z.string().max(32).default('0000').describe('PIN to unlock the display controls'),
})

export type CarouselSlideInput = z.infer<typeof carouselSlideInput>
export type CarouselPaletteInput = z.infer<typeof carouselPaletteInput>
export type MenuBoardPageInput = z.infer<typeof menuBoardPageInput>

/** Map agent slide input to service slide rows (stable slide-N ids). */
export function toServiceSlides(slides: CarouselSlideInput[], patternText: string) {
  return slides.map((slide, index) => ({
    id: `slide-${index}`,
    templateKey: slide.templateKey,
    data: {
      kicker: slide.kicker,
      headline: slide.headline,
      body: slide.body,
      items: slide.items,
      quote: slide.quote,
      author: slide.author,
      stat: slide.stat,
      statLabel: slide.statLabel,
      cta: slide.cta,
      footer: slide.footer,
      images: slide.images,
    },
    pattern: 'dots',
    patternColor: patternText,
    patternOpacity: 0.08,
    bgImage: null,
    customHtml: '',
  }))
}

/** Map agent board pages, generating stable ids for new pages. */
export function toServicePages(pages: MenuBoardPageInput[]) {
  return pages.map((page, index) => ({ ...page, id: page.id ?? `page-${index}` }))
}

export function appUrl(): string {
  try {
    const config = useRuntimeConfig()
    const raw = String(config.APP_URL || process.env.NUXT_APP_URL || 'http://localhost:3000')
    return raw.replace(/\/$/, '')
  } catch {
    return 'http://localhost:3000'
  }
}
