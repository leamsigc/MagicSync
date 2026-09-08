/**
 * GET /api/v1/accounts/[accountId]/grow - Follow recommendations for an account
 *
 * Query params:
 *   - limit: number (default 25, max 50)
 *
 * Currently Bluesky-only. Read-only: nothing here follows anyone.
 */

import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { growService } from '#layers/BaseScheduler/server/services/Grow.service';


export default defineEventHandler(async (event) => {
  const log = useLogger(event);

  try {
    const user = await checkUserIsLogin(event);
    const accountId = getRouterParam(event, 'accountId');

    if (!accountId) {
      throw createError({ statusCode: 400, statusMessage: 'Account ID is required' });
    }

    const { limit = '25' } = getQuery(event);
    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 25, 1), 50);

    const result = await growService.getRecommendations({
      accountId,
      userId: user.id,
      limit: parsedLimit,
    });

    return { success: true, data: result };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    if (error instanceof Error && error.message === 'Social media account not found') {
      throw createError({ statusCode: 404, statusMessage: 'Social media account not found' });
    }
    if (error instanceof Error && error.message.includes('not supported for this platform')) {
      throw createError({ statusCode: 400, statusMessage: error.message });
    }
    log.error({ content: 'Get grow recommendations error', error: String(error) });
    // Surface downstream (Bluesky API/auth) failures so the UI can show them
    if (error instanceof Error && error.message) {
      throw createError({ statusCode: 502, statusMessage: `Recommendations failed: ${error.message}` });
    }
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
