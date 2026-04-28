
export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event) => {
    const log = useLogger(event)
    await checkUserIsLogin(event)
    const body = await readBody(event);
    const { action, content, tone, platforms } = body;

    if (!action || !content) {
      throw createError({
        statusCode: 400,
        message: 'Missing required fields: action and content',
      });
    }

    try {
      log.set({ action, content, tone, platforms })

      let prompt = '';

      switch (action) {
        case 'smartSplit':
          prompt = schedulerGeneratePrompts.smartSplit(content, platforms);
          break;

        case 'rewrite':
          prompt = schedulerGeneratePrompts.rewrite(content, tone, platforms);
          break;

        case 'fixGrammar':
          prompt = schedulerGeneratePrompts.fixGrammar(content);
          break;

        case 'generateHashtags':
          prompt = schedulerGeneratePrompts.generateHashtags(content);
          break;

        case 'custom':
          prompt = schedulerGeneratePrompts.custom(content);
          break;

        default:
          throw createError({
            statusCode: 400,
            message: `Unknown action: ${action}`,
          });
      }

      const temperature = schedulerGetGenerateTemperature(action);

      const { text } = await schedulerUnifiedAI.generateText({
        systemPrompt: SCHEDULER_GENERATE_SYSTEM_PROMPT,
        prompt,
        temperature,
      });

      // For actions that return JSON arrays, parse them
      if (action === 'smartSplit' || action === 'generateHashtags') {
        try {
          // Remove markdown code blocks if present
          const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleanText);
          return { result: parsed };
        } catch {
          // If parsing fails, try to extract array-like content
          const arrayMatch = text.match(/\[[\s\S]*\]/);
          if (arrayMatch) {
            try {
              const parsed = JSON.parse(arrayMatch[0]);
              return { result: parsed };
            } catch {
              // Fallback: return as single item array
              return { result: [text] };
            }
          }
          return { result: [text] };
        }
      }

      return { result: text };
    } catch (error: any) {
      console.error('AI Generation Error:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to generate AI content',
      });
    }
  });
});
