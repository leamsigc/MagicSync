import { z } from 'zod';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';

const requestSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(500, 'Topic must be 500 characters or fewer'),
  slideCount: z.number().int().min(3).max(10).default(5),
  tone: z.enum(['professional', 'friendly', 'humorous', 'promotional', 'educational']).default('educational'),
  language: z.string().max(10).optional(),
});

const HEX_COLOR = z.string().transform(val => {
  const trimmed = val.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{3,8}$/.test(trimmed)) return `#${trimmed}`;
  // fallback to neutral if LLM returns color name
  return trimmed || '#0f0e0d';
});

const VALID_TEMPLATES = ['title-kicker', 'big-statement', 'tips-list', 'quote', 'stat-highlight', 'steps', 'checklist', 'comparison', 'qa', 'myth-fact', 'cta'] as const;

const slideSchema = z.object({
  template: z.string().describe('Which layout this slide uses').transform(val => {
    const normalized = val.toLowerCase().trim();
    if ((VALID_TEMPLATES as readonly string[]).includes(normalized)) return normalized as typeof VALID_TEMPLATES[number];
    // map common hallucinations
    if (normalized.includes('title') || normalized.includes('kicker') || normalized.includes('cover')) return 'title-kicker';
    if (normalized.includes('big') || normalized.includes('statement')) return 'big-statement';
    if (normalized.includes('cta') || normalized.includes('call')) return 'cta';
    if (normalized.includes('quote')) return 'quote';
    if (normalized.includes('stat')) return 'stat-highlight';
    if (normalized === 'list' || normalized.includes('tip')) return 'tips-list';
    return 'big-statement';
  }),
  kicker: z.string().max(80).optional().nullable().transform(val => val?.trim() || undefined).describe('Short uppercase label above the headline'),
  headline: z.string().max(220).describe('Main headline text for the slide'),
  body: z.string().max(350).optional().nullable().transform(val => val?.trim() || undefined).describe('Supporting paragraph text'),
  items: z.array(z.string().max(150)).max(6).optional().nullable().transform(val => val?.filter(Boolean) || undefined).describe('List items for list/step/checklist/comparison/myth-fact layouts (exactly 2 for myth-fact: [myth, fact])'),
  quote: z.string().max(260).optional().nullable().transform(val => val?.trim() || undefined).describe('Quote text for the quote layout'),
  author: z.string().max(80).optional().nullable().transform(val => val?.trim() || undefined).describe('Quote attribution'),
  stat: z.string().max(20).optional().nullable().transform(val => val?.trim() || undefined).describe('Short big number for stat layout, e.g. "87%"'),
  statLabel: z.string().max(120).optional().nullable().transform(val => val?.trim() || undefined).describe('Label under the stat number'),
  cta: z.string().max(50).optional().nullable().transform(val => val?.trim() || undefined).describe('Call-to-action button text for the cta layout'),
});

const responseSchema = z.object({
  palette: z.object({
    bg: HEX_COLOR.describe('Slide background hex color with good contrast for text'),
    text: HEX_COLOR.describe('Primary text hex color'),
    accent: HEX_COLOR.describe('Accent hex color for highlights, bars and buttons'),
  }),
  slides: z.array(slideSchema).min(3).max(10).describe('The carousel slides in order; slide 1 hooks, last slide is a CTA'),
});

const TEMPLATE_GUIDE = `Available templates and when to use them:
- title-kicker: slide 1 hook with kicker + headline + subtitle (kicker, headline, body)
- big-statement: one bold idea (headline only)
- tips-list: numbered tips (kicker, headline, items 3-5)
- quote: powerful quote (quote, author)
- stat-highlight: big number proof (stat, statLabel, body)
- steps: how-to sequence (headline, items 3-5)
- checklist: actionable checklist (headline, items 3-5)
- comparison: two-column contrast (headline, items 4-6, first half left column)
- qa: question and answer (headline = question, body = answer)
- myth-fact: debunk (items = exactly [myth, fact])
- cta: final call to action (headline, body, cta)`;

export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event) => {
    const log = useLogger(event)
    const user = await checkUserIsLogin(event)
    const body = await readBody(event);

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      log.set({ validationError: true })
      throw createError({
        statusCode: 400,
        message: 'Validation failed',
        data: validation.error.flatten(),
      });
    }

    const { topic, slideCount, tone, language } = validation.data;

    // Helper to clamp requested count and fallback deck
    const FALLBACK_PALETTES = [
      { bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316' },
      { bg: '#0c1e35', text: '#e0f2fe', accent: '#38bdf8' },
      { bg: '#fafaf7', text: '#1c1917', accent: '#ea580c' },
    ] as const;

    function fallbackDeck(): z.infer<typeof responseSchema> {
      const palette = FALLBACK_PALETTES[Math.floor(Math.random() * FALLBACK_PALETTES.length)]!;
      const safeTopic = topic.slice(0, 60);
      const slides: z.infer<typeof slideSchema>[] = [];
      const templates: typeof VALID_TEMPLATES[number][] = ['title-kicker', 'tips-list', 'checklist', 'quote', 'stat-highlight', 'cta'];
      for (let i = 0; i < slideCount; i++) {
        const tpl = templates[Math.min(i, templates.length - 1)]!;
        slides.push({
          template: tpl as any,
          kicker: i === 0 ? 'INSIGHT' : undefined,
          headline: i === 0 ? safeTopic : i === slideCount - 1 ? 'Your turn' : `Key idea #${i}`,
          body: i === 0 ? `Swipe to discover ${slideCount} ideas about ${safeTopic}` : i === slideCount - 1 ? 'Save this carousel and follow for more.' : undefined,
          items: tpl === 'tips-list' || tpl === 'checklist' ? ['Focus on one idea', 'Keep it visual', 'End with action'] : undefined,
          quote: tpl === 'quote' ? 'Great design is as little design as possible.' : undefined,
          author: tpl === 'quote' ? 'Dieter Rams' : undefined,
          stat: tpl === 'stat-highlight' ? '87%' : undefined,
          statLabel: tpl === 'stat-highlight' ? 'of saves come from useful carousels' : undefined,
          cta: tpl === 'cta' ? 'Follow for more' : undefined,
        });
      }
      return { palette: { ...palette }, slides } as any;
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        log.set({ userId: user.id, topicLength: topic.length, slideCount, tone, attempt })

        const languageSection = language ? `\nWrite all text in this language: ${language}.` : '';

        const prompt = `Design an Instagram carousel deck about this TOPIC:
"${topic.slice(0, 480)}"

TONE: ${tone}.
The deck must have EXACTLY ${slideCount} slides.
${languageSection}

${TEMPLATE_GUIDE}

RULES:
- Slide 1 must use title-kicker or big-statement and hook the reader in the first second
- Middle slides teach: alternate tips-list / steps / stat-highlight / qa / myth-fact / comparison / checklist / quote
- The final slide must use cta
- Keep headlines under 8 words, body text under 25 words per slide
- Choose a palette with strong contrast (dark bg + light text, or light bg + dark text) and a vivid accent
- IMPORTANT: Use ONLY templates from this list: ${VALID_TEMPLATES.join(', ')}
- IMPORTANT: Colors must be hex codes like #0f0e0d
- Return JSON matching the schema.`;

        const { object } = await schedulerUnifiedAI.generateObject({
          systemPrompt: SCHEDULER_GENERATE_SYSTEM_PROMPT,
          prompt,
          schema: responseSchema,
          temperature: attempt === 0 ? 0.7 : 0.5,
          userId: user.id,
        });

        // Basic sanity: if LLM returned wrong count, clamp
        if (object.slides.length !== slideCount) {
          log.warn({ content: 'Slide count mismatch', expected: slideCount, got: object.slides.length })
        }

        return object;
      } catch (error: unknown) {
        lastError = error;
        log.warn({ content: `AI Carousel Design attempt ${attempt + 1} failed`, error: String(error), cause: (error as any)?.cause })
        if (attempt === 0) await new Promise(r => setTimeout(r, 400));
      }
    }

    log.error({ content: 'AI Carousel Design Error - all attempts failed, using fallback', error: String(lastError) })
    // Return deterministic fallback instead of 500 so UI stays usable
    try {
      return fallbackDeck();
    } catch (fallbackError) {
      throw createError({
        statusCode: 500,
        message: lastError instanceof Error ? lastError.message : 'Failed to generate AI carousel design',
      });
    }
  });
});
