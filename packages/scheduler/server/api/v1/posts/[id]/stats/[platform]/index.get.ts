/**
 * GET /api/v1/posts/[id]/stats/[platform] - Get post insights for a specific platform
 *
 * Serves metric history from the `post_metrics` time-series table scoped to
 * the published platform post. `?refresh=1` forces a live collection from the
 * platform API, otherwise the latest stored snapshot is returned.
 */

import { and, desc, eq } from 'drizzle-orm';
import { postService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { statsCollectorService } from '#layers/BaseScheduler/server/services/StatsCollector.service';
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle';
import { postMetrics } from '#layers/BaseDB/db/schema';
import type { SocialMediaAccount } from '#layers/BaseDB/db/schema';

export default defineEventHandler(async (event) => {
  const log = useLogger(event);

  try {
    const user = await checkUserIsLogin(event);
    const postId = getRouterParam(event, 'id');
    const platform = getRouterParam(event, 'platform');

    if (!postId || !platform) {
      throw createError({ statusCode: 400, statusMessage: 'Post ID and platform are required' });
    }

    const post = await postService.findByIdFull({ postId, userId: user.id });
    if (!post) {
      throw createError({ statusCode: 404, statusMessage: 'Post not found' });
    }

    const platformPost = post.platformPosts?.find(
      (pp) => pp.platform === platform && pp.status === 'published'
    );

    if (!platformPost) {
      throw createError({ statusCode: 404, statusMessage: `No published post found for platform: ${platform}` });
    }

    const query = getQuery(event);
    const forceRefresh = query.refresh === '1' || query.refresh === 'true';

    if (forceRefresh) {
      const socialAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId);
      if (!socialAccount) {
        throw createError({ statusCode: 404, statusMessage: 'Social media account not found' });
      }
      await statsCollectorService.collectPostMetric({
        postFull: post,
        platformPost,
        account: socialAccount as unknown as SocialMediaAccount,
      });
    }

    const db = useDrizzle();
    const rows = await db.query.postMetrics.findMany({
      where: and(eq(postMetrics.postId, postId), eq(postMetrics.platformPostId, platformPost.id)),
      orderBy: desc(postMetrics.collectedAt),
      limit: 100,
    });

    const latest = rows[0];
    if (!latest) {
      return { success: true, data: null, cached: false, updatedAt: null, history: [] };
    }

    return {
      success: true,
      data: latest.metrics,
      raw: latest.rawPayload,
      cached: !forceRefresh,
      status: latest.status,
      error: latest.status === 'failed' ? latest.error : undefined,
      updatedAt: latest.collectedAt,
      history: rows.map((row) => ({ collectedAt: row.collectedAt, status: row.status, metrics: row.metrics })),
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    if (error instanceof Error && error.message === 'Post not found') {
      throw createError({ statusCode: 404, statusMessage: 'Post not found' });
    }
    log.error({ content: 'Get post stats error', error: String(error) });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
