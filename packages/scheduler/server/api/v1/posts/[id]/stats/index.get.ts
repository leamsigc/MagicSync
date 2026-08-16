/**
 * GET /api/v1/posts/[id]/stats - Get post stats for all platforms
 *
 * Returns an array of stats per platform. Each platform's data is cached
 * in entityDetails (social_media_post_stats) scoped by post+platform+account
 * and served forever until a refresh is requested via ?refresh=1.
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

    if (!postId) {
      throw createError({ statusCode: 400, statusMessage: 'Post ID is required' });
    }

    const post = await postService.findByIdFull({ postId, userId: user.id });
    if (!post) {
      throw createError({ statusCode: 404, statusMessage: 'Post not found' });
    }

    const trigger = new AutoPostService();
    const publishedPosts = post.platformPosts?.filter((pp) => pp.status === 'published') || [];

    if (publishedPosts.length === 0) {
      return { success: true, data: [], cached: false };
    }

    const query = getQuery(event);
    const forceRefresh = query.refresh === '1' || query.refresh === 'true';

    const results = await Promise.all(publishedPosts.map(async (platformPost) => {
      const platform = platformPost.platformPostId || platformPost.platform;
      const platformData: {
        platform: string;
        socialAccountId: string;
        status: string;
        publishedAt: unknown;
        error?: string;
        stats?: unknown;
        cached?: boolean;
        updatedAt?: unknown;
      } = {
        platform,
        socialAccountId: platformPost.socialAccountId,
        status: platformPost.status,
        publishedAt: platformPost.publishedAt,
      };

      try {
        const isSupportedPlatform = trigger.isSupportedPlatform(platform);
        if (!isSupportedPlatform) {
          platformData.error = `Unsupported platform: ${platform}`;
          return platformData;
        }

        const socialAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId);
        if (!socialAccount) {
          platformData.error = 'Social media account not found';
          return platformData;
        }

        const latestCache = await getPostStatsCache(postId, platform, platformPost.socialAccountId);

        if (!forceRefresh && latestCache) {
          platformData.stats = latestCache.details;
          platformData.cached = true;
          platformData.updatedAt = latestCache.updatedAt;
          return platformData;
        }

        const insights = await trigger.getPostInsights({
          post,
          socialAccount: socialAccount as unknown as Account,
          platform,
        });

        await savePostStatsCache(postId, platform, platformPost.socialAccountId, insights);

        platformData.stats = insights;
        platformData.cached = false;
        platformData.updatedAt = new Date().toISOString();
      } catch (err: unknown) {
        platformData.error = err instanceof Error ? err.message : 'Failed to fetch stats';
      }

      return platformData;
    }));

    return { success: true, data: results };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    if (error instanceof Error && error.message === 'Post not found') {
      throw createError({ statusCode: 404, statusMessage: 'Post not found' });
    }
    log.error({ content: 'Get all post stats error', error: String(error) });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
