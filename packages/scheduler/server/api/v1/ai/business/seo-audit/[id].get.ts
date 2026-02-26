import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { generateAIJSON } from '~/server/utils/ai';

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event);
  const businessId = event.context.params?.id || getQuery(event).id;

  if (!businessId || typeof businessId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing business id' });
  }

  const result = await businessProfileService.findById(businessId, user.id);
  if (result.error || !result.data) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' });
  }

  const business = result.data;

  try {
    const prompt = `Perform a comprehensive SEO audit for a website with these details:
Business Name: ${business.name}
Website: ${business.website}
Industry: ${business.category}
Description: ${business.description}

Provide a JSON response with the following structure:
{
  "score": <number 0-100>,
  "issues": [<array of SEO issues found>],
  "recommendations": [<array of actionable recommendations>]
}

Focus on:
1. Technical SEO (site speed, mobile-friendliness, structured data)
2. On-page SEO (meta tags, headings, keyword optimization)
3. Off-page SEO (backlinks, domain authority)
4. Content quality and freshness
5. User experience metrics

Respond with ONLY valid JSON, no markdown code blocks.`;

    return await generateAIJSON({
      prompt,
      temperature: 0.5,
      maxTokens: 2000
    });
  } catch (err: any) {
    console.error('SEO audit error:', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to run SEO audit'
    });
  }
});
