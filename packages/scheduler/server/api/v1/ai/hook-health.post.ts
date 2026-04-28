import { z } from 'zod';

const bodySchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  hookName: z.string().min(1, 'Hook name is required'),
  hooks: z.array(z.object({
    name: z.string().min(1, 'Hook name is required'),
    template: z.string().min(1, 'Hook template is required')
  })),
  script: z.string().min(1, 'Script is required'),
});

const responseSchema = z.object({
  overallScore: z.number().min(0).max(100).describe('Health score from 0 to 100'),
  metrics: z.object({
    hookStrength: z.number().min(0).max(100).describe('0 to 100'),
    relevance: z.number().min(0).max(100).describe('0 to 100'),
    retention: z.number().min(0).max(100).describe('0 to 100 estimated retention probability. >90 is desired.')
  }),
  feedback: z.string().describe('Brief feedback on how well the hook is used'),
  adjustments: z.array(z.string()).describe('Suggested adjustments to improve the hook and script'),
  improvedScript: z.string().describe('A fully rewritten, improved version of the script applying the adjustments'),
  alternativeVersions: z.array(z.object({
    hookName: z.string().describe('Name of the alternative hook'),
    predictedRetention: z.number().min(0).max(100).describe('Predicted retention score (0-100)'),
    script: z.string().describe('The fully rewritten script using this alternative hook'),
    reasoning: z.string().describe('Why this hook works better for this script')
  })).describe('Top 3 alternative versions of the script using different hooks that might perform better.')
});

export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event) => {
    await checkUserIsLogin(event);
    const body = await readBody(event);

    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        message: 'Validation failed',
        data: validation.error.flatten(),
      });
    }

    const { topic, hookName, hooks, script } = validation.data;

    try {
      const prompt = schedulerHookHealthPrompts.analyzeScript(topic, hookName, hooks, script);

      const { object } = await schedulerUnifiedAI.generateObject({
        systemPrompt: SCHEDULER_HOOK_HEALTH_SYSTEM_PROMPT,
        prompt,
        schema: responseSchema,
        temperature: SCHEDULER_HOOK_HEALTH_TEMPERATURE,
      });

      return object;
    } catch (error: any) {
      console.error('Hook Health Check Error:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to analyze hook health',
      });
    }
  });
});
