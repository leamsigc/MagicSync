import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { generateAIJSON } from '~/server/utils/ai';

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event);
  const businessId = event.context.params?.id || getQuery(event).id;
  const body = await readBody(event);

  if (!businessId || typeof businessId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing business id' });
  }

  const result = await businessProfileService.findById(businessId, user.id);
  if (result.error || !result.data) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' });
  }

  const business = result.data;
  const { connections = [], posts = [] } = body;

  try {
    const prompt = `Create a personalized 7-day growth strategy for a small business with these details:
Business Name: ${business.name}
Industry: ${business.category}
Website: ${business.website}
Description: ${business.description}

Current Status:
- Connected Platforms: ${connections.length || 0} social media accounts
- Published Posts: ${posts.length || 0}

Create a JSON response with a 7-day action plan:
{
  "days": [
    {
      "day": "Day 1",
      "task": "<specific actionable task for organic growth>"
    },
    // ... Day 2-7
  ]
}

Focus on:
1. Content creation and optimization
2. Social media engagement
3. Audience building
4. SEO improvements
5. Community interaction

Each task should be specific, measurable, and achievable within one day.
Respond with ONLY valid JSON, no markdown code blocks.`;

    return await generateAIJSON({
      prompt,
      temperature: 0.7,
      maxTokens: 2000
    });
  } catch (err: any) {
    console.error('Grow plan error:', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to generate grow plan'
    });
  }
});
