/**
 * GET /api/v1/posts/[id]/stats - Get post stats for all platforms
 *
 * Serves metric history from the `post_metrics` time-series table.
 * `?refresh=1` forces a live collection for every published platform post
 * (bypasses the adaptive due-gating), otherwise the latest stored snapshot
 * per platform post is returned.
 */

import { postService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { statsCollectorService } from '#layers/BaseScheduler/server/services/StatsCollector.service';
import { analyticsService } from '#layers/BaseScheduler/server/services/Analytics.service';
import type { SocialMediaAccount } from '#layers/BaseDB/db/schema';

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

    const publishedPosts = post.platformPosts?.filter((pp) => pp.status === 'published') || [];

    if (publishedPosts.length === 0) {
      return { success: true, data: [], history: [] };
    }

    const query = getQuery(event);
    const forceRefresh = query.refresh === '1' || query.refresh === 'true';

    if (forceRefresh) {
      for (const platformPost of publishedPosts) {
        const socialAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId);
        if (!socialAccount) continue;
        await statsCollectorService.collectPostMetric({
          postFull: post,
          platformPost,
          account: socialAccount,
        });
      }
    }

    const history = await analyticsService.getPostMetricsHistory({ postId });
    const byPlatformPost = new Map<string, typeof history>();
    for (const point of history) {
      if (!point.platformPostId) continue;
      const list = byPlatformPost.get(point.platformPostId) || [];
      list.push(point);
      byPlatformPost.set(point.platformPostId, list);
    }

    const results = publishedPosts.map((platformPost) => {
      const points = byPlatformPost.get(platformPost.id) || [];
      const latest = points.length > 0 ? points[points.length - 1] : undefined;
      return {
        platform: platformPost.platform,
        platformPostId: platformPost.id,
        socialAccountId: platformPost.socialAccountId,
        status: platformPost.status,
        publishedAt: platformPost.publishedAt,
        stats: latest?.metrics ?? null,
        cached: !forceRefresh && points.length > 0,
        updatedAt: latest?.collectedAt,
        error: latest?.status === 'failed' ? latest.error : undefined,
        history: points.map((point) => ({ collectedAt: point.collectedAt, status: point.status, metrics: point.metrics })),
      };
    });

    return { success: true, data: results, history };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    if (error instanceof Error && error.message === 'Post not found') {
      throw createError({ statusCode: 404, statusMessage: 'Post not found' });
    }
    log.error({ content: 'Get all post stats error', error: String(error) });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
