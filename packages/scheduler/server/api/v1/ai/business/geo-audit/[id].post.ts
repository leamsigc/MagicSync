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

  if (!body.keyword) {
    throw createError({ statusCode: 400, statusMessage: 'Keyword is required' });
  }

  const result = await businessProfileService.findById(businessId, user.id);
  if (result.error || !result.data) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' });
  }

  const business = result.data;
  const { keyword } = body;

  try {
    const prompt = `Conduct a GEO (Local Search Engine Optimization) audit for the following business:
Business Name: ${business.name}
Location/Address: ${business.address}
Industry: ${business.category}
Website: ${business.website}

Target Local Keyword: "${keyword}"

Analyze the business's local SEO presence and provide:
{
  "ranking": <estimated local ranking position 1-10+>,
  "actions": [
    "<specific action to improve local ranking>",
    // ... 5-7 more actions
  ]
}

Focus on:
1. Google Business Profile optimization
2. Local citation consistency
3. Review management
4. Local link building
5. Local content optimization
6. NAP (Name, Address, Phone) consistency
7. Location pages and schema markup

Each action should be specific and actionable.
Respond with ONLY valid JSON, no markdown code blocks.`;

    return await generateAIJSON({
      prompt,
      temperature: 0.5,
      maxTokens: 2000
    });
  } catch (err: any) {
    console.error('GEO audit error:', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to run GEO audit'
    });
  }
});
