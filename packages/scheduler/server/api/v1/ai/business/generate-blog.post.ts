import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { generateAIJSON } from '~/server/utils/ai';

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event);
  const body = await readBody(event);

  const { businessId, topic, keyword, businessDetails } = body;

  if (!businessId || !topic) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
  }

  try {
    const prompt = `Create an SEO-optimized blog post for a business with the following details:
Business Name: ${businessDetails?.name || 'N/A'}
Business Type: ${businessDetails?.category || 'N/A'}
Website: ${businessDetails?.website || 'N/A'}

Topic: ${topic}
Target Keyword: ${keyword || 'general'}

Requirements:
- Write a comprehensive blog post (500-1000 words)
- Include the target keyword naturally throughout
- Structure with proper headings
- Add a compelling introduction and conclusion
- Format the response as valid JSON with fields: title (string), content (string)

Respond with ONLY valid JSON, no markdown code blocks.`;

    const result = await generateAIJSON({
      prompt,
      temperature: 0.7,
      maxTokens: 2000
    });

    return {
      title: result.title,
      content: result.content
    };
  } catch (err: any) {
    console.error('Blog generation error:', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to generate blog post'
    });
  }
});
