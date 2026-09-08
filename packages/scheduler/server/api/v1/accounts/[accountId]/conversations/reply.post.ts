/**
 * POST /api/v1/accounts/[accountId]/conversations/reply - Reply to a DM conversation
 *
 * Body:
 *   - conversationId: string
 *   - message: string (1-1000 chars)
 *
 * Note: Meta enforces a 24h customer-service window for replies. Messages
 * outside the window are rejected by the API and surfaced as errors.
 */

import { z } from 'zod';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service';
import type { Account } from '#layers/BaseDB/db/schema';

const replySchema = z.object({
  conversationId: z.string().min(1),
  message: z.string().min(1).max(1000),
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
    const { conversationId, message } = replySchema.parse(body);

    // Ownership check: account must belong to the caller
    const socialAccount = await socialMediaAccountService.getAccountById(accountId, user.id);
    if (!socialAccount) {
      throw createError({ statusCode: 404, statusMessage: 'Social media account not found' });
    }

    const trigger = new AutoPostService();
    if (!trigger.isSupportedPlatform(socialAccount.platform)) {
      throw createError({ statusCode: 400, statusMessage: `Unsupported platform: ${socialAccount.platform}` });
    }
    if (!trigger.supportsDMs(socialAccount.platform)) {
      throw createError({ statusCode: 400, statusMessage: 'DM replies are not supported for this platform yet' });
    }

    const result = await trigger.replyToConversation({
      socialAccount: socialAccount as unknown as Account,
      platform: socialAccount.platform,
      conversationId,
      message,
    });

    if (!result.success) {
      // statusMessage must stay single-line: Meta errors can contain newlines,
      // which abort the Node response (Cloudflare then serves a 502 HTML page).
      throw createError({ statusCode: 400, statusMessage: 'Failed to send reply', message: result.error || 'Failed to send reply' });
    }

    return { success: true, data: result };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Error', data: error.issues });
    }
    log.error({ content: 'Reply to conversation error', error: String(error) });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
