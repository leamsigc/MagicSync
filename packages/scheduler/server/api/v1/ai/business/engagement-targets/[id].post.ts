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

  if (!body.platform || !body.keyword) {
    throw createError({ statusCode: 400, statusMessage: 'Platform and keyword are required' });
  }

  const result = await businessProfileService.findById(businessId, user.id);
  if (result.error || !result.data) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' });
  }

  const business = result.data;
  const { platform, keyword } = body;

  try {
    const prompt = `Find high-engagement social media opportunities for a ${platform} business:
Business Name: ${business.name}
Industry: ${business.category}
Business Details: ${business.description}

Search Keyword: "${keyword}"

Generate a list of 5-10 high-engagement post opportunities that this business should target on ${platform}.
For each opportunity, provide realistic engagement metrics.

Response JSON structure:
{
  "opportunities": [
    {
      "id": "unique_id_1",
      "title": "<post title/topic>",
      "engagement": "<estimated engagement rate, e.g., '15.2% engagement'>"
    },
    // ... more opportunities
  ]
}

Consider:
1. Trending topics related to the keyword
2. Similar successful posts in the industry
3. User engagement patterns on ${platform}
4. Audience interests and pain points
5. Seasonal and timely opportunities

Respond with ONLY valid JSON, no markdown code blocks.`;

    return await generateAIJSON({
      prompt,
      temperature: 0.7,
      maxTokens: 2000
    });
  } catch (err: any) {
    console.error('Engagement targets error:', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to search engagement targets'
    });
  }
});
