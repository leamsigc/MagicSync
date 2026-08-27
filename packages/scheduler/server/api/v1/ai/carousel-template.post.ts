import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

const requestSchema = z.object({
  prompt: z.string().min(5, 'Prompt is required').max(600, 'Prompt must be 600 chars or fewer'),
  slideCount: z.number().int().min(3).max(10).default(5),
  language: z.string().max(10).optional(),
})

const HEX_COLOR = z.string().transform((val) => {
  const trimmed = val.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed
  if (/^[0-9a-fA-F]{3,8}$/.test(trimmed)) return `#${trimmed}`
  return trimmed || '#0f0e0d'
})

const VALID_TEMPLATES = ['title-kicker', 'big-statement', 'tips-list', 'quote', 'stat-highlight', 'steps', 'checklist', 'comparison', 'photo-left', 'full-photo', 'qa', 'myth-fact', 'cta', 'photo-grid', 'polaroid', 'stat-cards', 'split-band', 'number-hero', 'feature-highlight', 'testimonial', 'timeline', 'image-focus'] as const
const VALID_PATTERNS = ['none', 'dots', 'dots-dense', 'grid', 'grid-fine', 'diagonal', 'diagonal-wide', 'crosshatch', 'waves', 'rings', 'zigzag', 'checker', 'blueprint', 'halftone', 'confetti'] as const

const slideSchema = z.object({
  template: z.string().describe('Which layout this slide uses').transform((val) => {
    const normalized = val.toLowerCase().trim()
    if ((VALID_TEMPLATES as readonly string[]).includes(normalized)) return normalized as typeof VALID_TEMPLATES[number]
    if (normalized.includes('title') || normalized.includes('kicker') || normalized.includes('cover')) return 'title-kicker'
    if (normalized.includes('big') || normalized.includes('statement')) return 'big-statement'
    if (normalized.includes('cta') || normalized.includes('call')) return 'cta'
    if (normalized.includes('quote') || normalized.includes('testimonial')) return 'testimonial'
    if (normalized.includes('stat')) return 'stat-highlight'
    if (normalized.includes('number') || normalized.includes('hero')) return 'number-hero'
    if (normalized.includes('feature')) return 'feature-highlight'
    if (normalized.includes('timeline')) return 'timeline'
    if (normalized.includes('image-focus') || normalized.includes('image_focus')) return 'image-focus'
    return 'big-statement'
  }),
  kicker: z.string().max(80).optional().nullable().transform(v => v?.trim() || undefined),
  headline: z.string().max(220).describe('Main headline'),
  body: z.string().max(350).optional().nullable().transform(v => v?.trim() || undefined),
  items: z.array(z.string().max(150)).max(6).optional().nullable().transform(v => v?.filter(Boolean) || undefined),
  quote: z.string().max(260).optional().nullable().transform(v => v?.trim() || undefined),
  author: z.string().max(80).optional().nullable().transform(v => v?.trim() || undefined),
  stat: z.string().max(20).optional().nullable().transform(v => v?.trim() || undefined),
  statLabel: z.string().max(120).optional().nullable().transform(v => v?.trim() || undefined),
  cta: z.string().max(50).optional().nullable().transform(v => v?.trim() || undefined),
  images: z.array(z.string().max(500)).max(4).optional().nullable().transform(v => v?.filter(Boolean) || undefined),
})

const responseSchema = z.object({
  key: z.string().max(40).describe('Unique kebab-case key for the template, e.g. organic-minimal'),
  title: z.string().max(60).describe('Human title, 2-4 words'),
  description: z.string().max(140).describe('Short description, mention page count and vibe'),
  palette: z.object({
    bg: HEX_COLOR.describe('Background hex'),
    text: HEX_COLOR.describe('Text hex'),
    accent: HEX_COLOR.describe('Accent hex'),
    font: z.string().max(40).optional().nullable().transform(v => v?.trim() || undefined).describe('One of: Arial, Impact, Georgia, Courier New, Comic Sans MS, Palatino, Century Gothic, Trebuchet MS, Verdana, Arial Black'),
  }),
  pattern: z.string().describe('One of valid patterns').transform(v => {
    const n = v.toLowerCase().trim()
    if ((VALID_PATTERNS as readonly string[]).includes(n)) return n
    return 'dots'
  }),
  slides: z.array(slideSchema).min(3).max(10).describe('Slides in order; first is cover hook, last is CTA'),
})

const TEMPLATE_GUIDE = `Available slide layouts:
- title-kicker: cover with kicker + headline + body
- big-statement: one bold headline
- tips-list: numbered tips (items 3-5)
- quote: quote + author
- stat-highlight: big number (stat, statLabel, body)
- steps: sequential steps (items)
- checklist: checklist (items)
- comparison: two-column contrast (items 4-6)
- photo-left: image left text right (headline, body)
- full-photo: full-bleed image with overlay text
- qa: question (headline) + answer (body)
- myth-fact: debunk (items exactly [myth, fact])
- cta: finale (headline, body, cta)
- photo-grid: 2x2 photo grid (kicker, headline, images)
- polaroid: framed photo (headline, body, images[0])
- stat-cards: numbered cards (headline, items 3)
- split-band: angled accent band (kicker, headline, body)
- number-hero: giant number + headline + body + items (viral)
- feature-highlight: 3 feature cards (kicker, headline, body, items 3)
- testimonial: avatar + quote + author + body
- timeline: vertical timeline (headline, body, items up to 5)
- image-focus: large image with caption bar (kicker, headline, body, images[0])

Patterns: ${VALID_PATTERNS.join(', ')}
Fonts: Arial, Arial Black, Impact, Georgia, Courier New, Verdana, Trebuchet MS, Comic Sans MS, Palatino, Century Gothic`

export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event) => {
    const log = useLogger(event)
    const user = await checkUserIsLogin(event)
    const body = await readBody(event)
    const validation = requestSchema.safeParse(body)
    if (!validation.success) {
      log.set({ validationError: true })
      throw createError({ statusCode: 400, message: 'Validation failed', data: validation.error.flatten() })
    }
    const { prompt, slideCount, language } = validation.data

    const fallback = (): z.infer<typeof responseSchema> => ({
      key: `ai-${Date.now().toString(36)}`,
      title: 'AI Generated Deck',
      description: `${slideCount} pages — AI-crafted from your prompt`,
      palette: { bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316', font: 'Arial' },
      pattern: 'dots',
      slides: Array.from({ length: slideCount }, (_, i) => ({
        template: i === 0 ? 'title-kicker' : i === slideCount - 1 ? 'cta' : i % 2 === 0 ? 'tips-list' : 'quote',
        kicker: i === 0 ? 'AI DECK' : undefined,
        headline: i === 0 ? prompt.slice(0, 60) : i === slideCount - 1 ? 'Your turn' : `Idea ${i}`,
        body: i === 0 ? prompt.slice(0, 120) : i === slideCount - 1 ? 'Save and follow for more.' : undefined,
        items: i !== 0 && i !== slideCount - 1 && i % 2 === 0 ? ['Focus on value', 'Keep it visual', 'End with action'] : undefined,
        quote: i !== 0 && i !== slideCount - 1 && i % 2 === 1 ? 'Great design is invisible.' : undefined,
        author: i !== 0 && i !== slideCount - 1 && i % 2 === 1 ? 'Dieter Rams' : undefined,
        cta: i === slideCount - 1 ? 'Follow for more' : undefined,
      })) as any,
    })

    let lastError: unknown = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        log.set({ userId: user.id, promptLength: prompt.length, slideCount, attempt })
        const languageSection = language ? `\nWrite all text in language: ${language}.` : ''

        const aiPrompt = `You are designing a reusable Instagram carousel TEMPLATE.

User wants: "${prompt.slice(0, 580)}"
Need EXACTLY ${slideCount} slides. ${languageSection}

${TEMPLATE_GUIDE}

RULES:
- First slide must hook (title-kicker or big-statement or split-band)
- Last slide must be cta with compelling cta button text
- Middle slides alternate layouts: use number-hero, feature-highlight, testimonial, timeline, image-focus, stat-highlight, etc. Mix them — don't repeat same layout more than twice in a row
- Make headlines punchy (<=8 words), body supportive (<=25 words)
- Choose a cohesive palette with strong contrast and a vivid accent that matches the vibe described
- Pick a pattern that matches the vibe (e.g., minimal -> none/grid-fine, playful -> confetti, premium -> rings)
- Font must match vibe (e.g., luxury -> Georgia/Palatino, bold -> Impact/Arial Black, friendly -> Comic Sans MS/Century Gothic)
- Title: 2-4 words, Description: include page count + vibe (e.g., "5 pages — bold cyberpunk")
- Key: kebab-case from title (e.g., "cyber-neon-pulse")
- IMPORTANT: Use only allowed template keys and pattern keys listed above.
- Return JSON matching the schema.`

        const { object } = await schedulerUnifiedAI.generateObject({
          systemPrompt: SCHEDULER_GENERATE_SYSTEM_PROMPT,
          prompt: aiPrompt,
          schema: responseSchema,
          temperature: attempt === 0 ? 0.85 : 0.6,
          userId: user.id,
        })

        // Ensure unique key if missing
        if (!object.key || object.key.length < 2) object.key = `ai-${Date.now().toString(36)}`
        object.key = object.key.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 40)
        // Clamp slides to requested count if LLM off by 1-2
        if (object.slides.length !== slideCount) {
          log.warn({ content: 'Template slide count mismatch', expected: slideCount, got: object.slides.length })
          if (object.slides.length > slideCount) object.slides = object.slides.slice(0, slideCount)
        }

        return object
      } catch (error) {
        lastError = error
        log.warn({ content: `AI Template attempt ${attempt + 1} failed`, error: String(error), cause: (error as any)?.cause })
        if (attempt === 0) await new Promise(r => setTimeout(r, 400))
      }
    }

    log.error({ content: 'AI Template generation failed, using fallback', error: String(lastError) })
    try {
      return fallback()
    } catch {
      throw createError({ statusCode: 500, message: lastError instanceof Error ? lastError.message : 'Failed to generate template' })
    }
  })
})
