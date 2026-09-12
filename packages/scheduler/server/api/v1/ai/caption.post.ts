import { z } from 'zod';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';

const requestSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(500, 'Topic must be 500 characters or fewer'),
  platforms: z.array(z.string().max(50)).max(20).default([]),
  tone: z.enum(['professional', 'friendly', 'humorous', 'promotional']).default('professional'),
  kind: z.enum(['caption', 'hashtags', 'both']).default('both'),
  language: z.string().max(10).optional(),
});

const responseSchema = z.object({
  captions: z.array(z.string()).describe('3 alternative ready-to-publish social media captions about the topic'),
  hashtags: z.array(z.string()).describe('5-10 strategic hashtags including the # symbol'),
});

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

    const { topic, platforms, tone, kind, language } = validation.data;

    try {
      log.set({ userId: user.id, kind, tone, topicLength: topic.length })

      const platformSection = platforms.length > 0
        ? `\nTarget platforms: ${platforms.join(', ')}. Optimize length and style for them.`
        : '\nWrite one generic version that works on all platforms.';
      const languageSection = language ? `\nWrite all content in this language: ${language}.` : '';
      const scopeSection = kind === 'caption'
        ? 'Generate ONLY captions; return an empty hashtags array.'
        : kind === 'hashtags'
          ? 'Generate ONLY hashtags; return an empty captions array.'
          : 'Generate both captions and hashtags.';

      const prompt = `Write social media content about this TOPIC:
"${topic}"
${platformSection}${languageSection}

TONE: ${tone}.
${scopeSection}

CAPTIONS RULES:
- Provide exactly 3 distinct alternatives with different angles
- Each caption is a complete ready-to-publish post with a scroll-stopping first line
- No hashtag lists inside captions

HASHTAGS RULES:
- 5-10 hashtags, each starting with #
- Mix broad + niche + specific tags, no generic spam tags

Return JSON matching the schema.`;

      const { object } = await schedulerUnifiedAI.generateObject({
        systemPrompt: SCHEDULER_GENERATE_SYSTEM_PROMPT,
        prompt,
        schema: responseSchema,
        temperature: 0.7,
        userId: user.id,
        businessId: body.businessId ?? body.business_id ?? null,
        useBusinessContext: body.useBusinessContext === true || body.use_business_context === true,
        event,
      });

      return {
        captions: kind === 'hashtags' ? [] : object.captions,
        hashtags: kind === 'caption' ? [] : object.hashtags,
      };
    } catch (error: unknown) {
      log.error({ content: 'AI Caption Generation Error', error: String(error) })
      throw createError({
        statusCode: 500,
        message: error instanceof Error ? error.message : 'Failed to generate AI caption content',
      });
    }
  });
});
