/**
 * GET /api/v1/posts/[id]/stats/[platform] - Get post insights for a specific platform
 *
 * Uses cached data scoped by post+platform+account in entityDetails
 * (social_media_post_stats) and serves it forever until a refresh is
 * requested via ?refresh=1, which fetches fresh data from the platform API.
 */

import { postService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service';
import { getPostStatsCache, savePostStatsCache } from '#layers/BaseScheduler/server/utils/PostStatsCache';
import type { Account } from '#layers/BaseDB/db/schema';

export default defineEventHandler(async (event) => {
  const log = useLogger(event);

  try {
    const user = await checkUserIsLogin(event);
    const postId = getRouterParam(event, 'id');
    const platform = getRouterParam(event, 'platform');

    if (!postId || !platform) {
      throw createError({ statusCode: 400, statusMessage: 'Post ID and platform are required' });
    }

    const trigger = new AutoPostService();
    const isSupportedPlatform = trigger.isSupportedPlatform(platform);

    if (!isSupportedPlatform) {
      throw createError({ statusCode: 400, statusMessage: `Unsupported platform: ${platform}` });
    }

    const post = await postService.findByIdFull({ postId, userId: user.id });
    if (!post) {
      throw createError({ statusCode: 404, statusMessage: 'Post not found' });
    }

    const platformPost = post.platformPosts?.find(
      (pp) => pp.platformPostId === platform || pp.platform === platform
    );

    if (!platformPost) {
      throw createError({ statusCode: 404, statusMessage: `No published post found for platform: ${platform}` });
    }

    const socialAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId);
    if (!socialAccount) {
      throw createError({ statusCode: 404, statusMessage: 'Social media account not found' });
    }

    const query = getQuery(event);
    const forceRefresh = query.refresh === '1' || query.refresh === 'true';

    const latestCache = await getPostStatsCache(postId, platform, platformPost.socialAccountId);

    if (!forceRefresh && latestCache) {
      return { success: true, data: latestCache.details, cached: true, updatedAt: latestCache.updatedAt };
    }

    const insights = await trigger.getPostInsights({
      post,
      socialAccount: socialAccount as unknown as Account,
      platform,
    });

    await savePostStatsCache(postId, platform, platformPost.socialAccountId, insights);

    return { success: true, data: insights, cached: false, updatedAt: new Date().toISOString() };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    if (error instanceof Error && error.message === 'Post not found') {
      throw createError({ statusCode: 404, statusMessage: 'Post not found' });
    }
    log.error({ content: 'Get post stats error', error: String(error) });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
