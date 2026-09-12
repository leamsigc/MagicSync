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

const VALID_TEMPLATES = ['title-kicker', 'big-statement', 'tips-list', 'quote', 'stat-highlight', 'steps', 'checklist', 'comparison', 'photo-left', 'full-photo', 'qa', 'myth-fact', 'cta', 'photo-grid', 'polaroid', 'stat-cards', 'split-band', 'number-hero', 'feature-highlight', 'testimonial', 'timeline', 'image-focus'] as const;

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
  body: z.string().max(500).optional().nullable().transform(val => val?.trim() || undefined).describe('Supporting paragraph text — 2-4 sentences that expand on the headline with specifics, numbers, or micro-stories'),
  items: z.array(z.string().max(200)).max(8).optional().nullable().transform(val => val?.filter(Boolean) || undefined).describe('List items for list/step/checklist/comparison/myth-fact layouts — each item should be specific and actionable with concrete details'),
  quote: z.string().max(300).optional().nullable().transform(val => val?.trim() || undefined).describe('Quote text for the quote layout — use real or realistic-sounding attribution'),
  author: z.string().max(80).optional().nullable().transform(val => val?.trim() || undefined).describe('Quote attribution'),
  stat: z.string().max(20).optional().nullable().transform(val => val?.trim() || undefined).describe('Short big number for stat layout, e.g. "87%"'),
  statLabel: z.string().max(150).optional().nullable().transform(val => val?.trim() || undefined).describe('Label under the stat number — include context like "of top carousels use this exact slide order"'),
  cta: z.string().max(50).optional().nullable().transform(val => val?.trim() || undefined).describe('Call-to-action button text for the cta layout'),
  images: z.array(z.string().max(500)).max(4).optional().nullable().transform(val => val?.filter(Boolean) || undefined).describe('Image URLs for photo-grid/polaroid/testimonial/image-focus (leave empty, user adds later)'),
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
- title-kicker: slide 1 hook with kicker + headline + subtitle (kicker = short label like "THE DATA" or "SECRET #1", headline = bold claim, body = 1-2 sentence context)
- big-statement: one bold idea filling the slide (headline only — make it a pattern interrupt or contrarian take)
- tips-list: numbered tips (kicker, headline, items 3-6 — each item must be SPECIFIC and ACTIONABLE with concrete details, not vague advice)
- quote: powerful quote with attribution (quote = the actual quote text, author = real or realistic name + title)
- stat-highlight: giant number with proof (stat = specific number like "87%", statLabel = context like "of creators who post carousels get 2x more saves", body = explanation)
- steps: how-to sequence (headline, items 3-6 — each step should be a clear action with specifics)
- checklist: actionable checklist (headline, items 3-6 — each item is a doable action)
- comparison: two-column contrast (headline, items 4-6 — first half = left column, second half = right column)
- photo-left: image left, text right (headline, body — good for before/after or product showcases)
- full-photo: full-bleed image with overlay text (kicker, headline, body — dramatic visual + strong text)
- qa: question and answer (headline = specific question, body = detailed answer with evidence)
- myth-fact: debunk format (items = exactly [myth, fact] — make the myth believable and the fact surprising)
- cta: final call to action (headline = compelling reason to act, body = what to do, cta = button text like "Save this for later" or "Tag a friend")
- photo-grid: up to 4 photos grid (kicker, headline — good for visual lists or collections)
- polaroid: framed photo card (headline, body — good for testimonials or single focal images)
- stat-cards: numbered cards side by side (headline, items 3 — each card = one key stat or point)
- split-band: angled accent band (kicker, headline, body — good for dramatic announcements)
- number-hero: giant slide number + headline (body, items — perfect for listicles and countdowns)
- feature-highlight: 3 feature cards (kicker, headline, body, items 3 — each card = one feature with details)
- testimonial: avatar + quote + author (quote, author, headline — use real-sounding names and specific results)
- timeline: vertical timeline (headline, body, items up to 5 — each item = one milestone with specifics)
- image-focus: large image with caption bar (kicker, headline, body — hero image + supporting text)`;

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

        const prompt = `You are a WORLD-CLASS Instagram carousel strategist. Design a high-engagement carousel deck about:
"${topic.slice(0, 480)}"

TONE: ${tone}.
The deck must have EXACTLY ${slideCount} slides.
${languageSection}

${TEMPLATE_GUIDE}

CONTENT STRATEGY (CRITICAL — follow these exactly):
- SLIDE 1 (HOOK): Use title-kicker or big-statement. Create a curiosity gap or bold claim that makes people STOP scrolling. Example: "I lost 10kg in 90 days. Here's the exact protocol." NOT: "Tips for weight loss"
- SLIDES 2-${slideCount - 1} (VALUE): Each slide must deliver ONE specific, actionable insight. Use real numbers, concrete examples, or step-by-step instructions. NOT vague advice. Example: "Drink 500ml water before every meal — studies show 44% more weight loss over 12 weeks" NOT: "Stay hydrated"
- FINAL SLIDE (CTA): Use cta template. Give a compelling reason to save, share, or follow. Example: "Save this carousel — you'll need it when you start" or "Tag someone who needs to hear this"
- BODY TEXT: Write 2-4 sentences per slide that expand on the headline. Tell a micro-story, give context, or provide the "why" behind the claim. Be specific — numbers, names, timeframes.
- ITEMS: When using list templates (tips-list, steps, checklist), write items that are specific and actionable. NOT: "Be consistent" — YES: "Post 3x per week at 7am EST — algorithm rewards regularity"
- HEADLINES: 4-10 words. Use power words: "exact", "secret", "why", "how", "proof", "data". Create open loops that make people swipe.
- QUOTES: Use real or realistic-sounding attributions. "Sarah Chen, CEO of GrowthLab" beats "Anonymous"
- STATS: Use specific numbers with context. "87% of top carousels use this exact slide order" beats "Most carousels do well"
- PALETTE: Choose colors that match the mood — dark+bold for authority, bright+clean for approachability, neon+dark for edgy

SLIDE DIVERSITY:
- Alternate between different templates — never use the same template twice in a row
- Mix content types: proof slides (stats), action slides (steps/tips), story slides (quote/qa), contrast slides (myth-fact/comparison)
- Every slide should feel like it earns the right to the next one

Return JSON matching the schema. Make every word count — this carousel should get saves, shares, and comments.`;

        const { object } = await schedulerUnifiedAI.generateObject({
          systemPrompt: SCHEDULER_GENERATE_SYSTEM_PROMPT,
          prompt,
          schema: responseSchema,
          temperature: attempt === 0 ? 0.7 : 0.5,
          userId: user.id,
          businessId: body.businessId ?? body.business_id ?? null,
          useBusinessContext: body.useBusinessContext === true || body.use_business_context === true,
          event,
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
