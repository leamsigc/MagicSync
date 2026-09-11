/**
 * GET /api/v1/accounts/[accountId]/conversations - List DM conversations for a connected account
 *
 * Query params:
 *   - limit: number (default 25, max 50)
 *   - cursor: string (for pagination)
 *
 * Wired for Facebook pages + Instagram Business accounts. Other platforms
 * return 400 until their plugins implement getConversations().
 */

import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service';
import type { Account } from '#layers/BaseDB/db/schema';


export default defineEventHandler(async (event) => {
  const log = useLogger(event);

  try {
    const user = await checkUserIsLogin(event);
    const accountId = getRouterParam(event, 'accountId');

    if (!accountId) {
      throw createError({ statusCode: 400, statusMessage: 'Account ID is required' });
    }

    const { limit = '25', cursor } = getQuery(event);
    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 25, 1), 50);

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
      throw createError({ statusCode: 400, statusMessage: 'DM conversations are not supported for this platform yet' });
    }

    const result = await trigger.getConversations({
      socialAccount: socialAccount,
      platform: socialAccount.platform,
      limit: parsedLimit,
      cursor: cursor as string | undefined,
    });

    return { success: true, data: result };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    if (error instanceof Error && error.message === 'Not implemented') {
      throw createError({ statusCode: 400, statusMessage: 'DM conversations are not supported for this platform yet' });
    }
    log.error({ content: 'Get conversations error', error: String(error) });
    const message = error instanceof Error ? error.message : String(error);
    // Surface Meta's actual error instead of a generic 500: expired tokens
    // must tell the user to reconnect, other API errors carry Meta's reason.
    if (/validating access token|expired|revoked|invalid oauth|session has expired/i.test(message)) {
      throw createError({ statusCode: 401, statusMessage: 'Facebook token expired or invalid. Please reconnect your account.' });
    }
    // Instagram/Facebook capability + permission errors are actionable:
    // app not Live, tester role missing, or scopes predate reconnect.
    if (/does not have the capability|\(#3\)/i.test(message)) {
      throw createError({ statusCode: 502, statusMessage: 'Upstream platform error', message: `${message.slice(0, 500)} — Meta capability error: set the app Live, add the account as tester, and reconnect to grant instagram_manage_messages.` });
    }
    if (/\(#200\)|missing permissions|permission/i.test(message)) {
      throw createError({ statusCode: 502, statusMessage: 'Upstream platform error', message: `${message.slice(0, 500)} — Meta permission error: reconnect to grant the latest scopes.` });
    }
    if (message.startsWith('Facebook API Error') || message.startsWith('Instagram conversations failed')) {
      // statusMessage must stay single-line (see reply.post.ts): full Meta
      // text goes in `message`.
      throw createError({ statusCode: 502, statusMessage: 'Upstream platform error', message });
    }
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
