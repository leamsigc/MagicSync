/**
 * POST /api/v1/accounts/[accountId]/grow/follow - Manually follow an account
 *
 * Body:
 *   - did: string (Bluesky DID, e.g. did:plc:...)
 *
 * Explicit user action only. Nothing in the system calls this automatically.
 */

import { z } from 'zod';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { growService } from '#layers/BaseScheduler/server/services/Grow.service';

const followSchema = z.object({
  did: z.string().min(1).startsWith('did:'),
});


export default defineEventHandler(async (event) => {
  const log = useLogger(event);

  try {
    const user = await checkUserIsLogin(event);
    const accountId = getRouterParam(event, 'accountId');

    if (!accountId) {
      throw createError({ statusCode: 400, statusMessage: 'Account ID is required' });
    }

    const body = await readBody(event);
    const { did } = followSchema.parse(body);

    const result = await growService.followAccount({
      accountId,
      userId: user.id,
      did,
    });

    if (!result.success) {
      throw createError({ statusCode: 400, statusMessage: result.error || 'Failed to follow account' });
    }

    return { success: true, data: result };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Error', data: error.issues });
    }
    if (error instanceof Error && error.message === 'Social media account not found') {
      throw createError({ statusCode: 404, statusMessage: 'Social media account not found' });
    }
    log.error({ content: 'Grow follow error', error: String(error) });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
