import { z } from 'zod';

const expectedResponseSchema = z.object({
  content: z.string().describe('For short content, the first item is the hook/start. For long content (like articles), this is the full content.'),
  comments: z.array(z.string()).optional().describe('Optional follow-up comments or thread continuation.'),
});

const requestSchema = z.object({
  content: z.string().optional(),
  url: z.string().url().optional(),
  platforms: z.array(z.enum(SCHEDULER_SUPPORTED_PLATFORMS)).min(1),
  tone: z.enum(SCHEDULER_SUPPORTED_TONES).default('professional'),
}).refine(data => data.content || data.url, {
  message: 'Either content or url must be provided',
});

export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event) => {
    await checkUserIsLogin(event)
    const body = await readBody(event);

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        message: 'Validation failed',
        data: validation.error.flatten(),
      });
    }

    const { content: rawContent, url, platforms, tone } = validation.data;

    let contentToProcess = rawContent || '';

    if (url && !rawContent) {
      try {
        const extracted = await extractMainContent(url);
        contentToProcess = `Title: ${extracted.title}\n\n${extracted.content}`;
      } catch (error: any) {
        throw createError({
          statusCode: 400,
          message: `Failed to scrape URL: ${error.message}`,
        });
      }
    }

    if (!contentToProcess.trim()) {
      throw createError({
        statusCode: 400,
        message: 'No content available to process',
      });
    }

    try {
      const systemPrompt = schedulerRepurposePrompts.getSystemPrompt();
      const userPrompt = schedulerRepurposePrompts.createUserPrompt(contentToProcess, platforms, tone);

      // Dynamically build the schema based on requested platforms
      const resultSchema = z.object(
        platforms.reduce((acc, platform) => {
          acc[platform] = expectedResponseSchema;
          return acc;
        }, {} as Record<string, typeof expectedResponseSchema>)
      );

      const { object } = await schedulerUnifiedAI.generateObject({
        systemPrompt,
        prompt: userPrompt,
        schema: resultSchema,
        temperature: SCHEDULER_REPURPOSE_TEMPERATURE,
      });

      return { results: object };
    } catch (error: any) {
      console.error('AI Generation Error:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to generate AI content',
      });
    }
  });
});
