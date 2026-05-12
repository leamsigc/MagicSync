/**
 * GET /api/v1/posts/[id]/stats - Get post stats for all platforms
 *
 * Returns an array of stats per platform. Each platform's data is cached
 * in entityDetails (social_media_post_stats) with a 1-hour TTL.
 */

import { postService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails';
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service';
import { eq, and, inArray } from 'drizzle-orm';
import dayjs from 'dayjs';

const ENTITY_TYPE = 'social_media_post_stats';
const CACHE_TTL_HOURS = 1;

export default defineEventHandler(async (event) => {
  const log = useLogger(event);
  const db = useDrizzle();

  try {
    const user = await checkUserIsLogin(event);
    const postId = getRouterParam(event, 'id');

    if (!postId) {
      throw createError({ statusCode: 400, statusMessage: 'Post ID is required' });
    }

    const post = await postService.findByIdFull({ postId });
    if (!post) {
      throw createError({ statusCode: 404, statusMessage: 'Post not found' });
    }

    const trigger = new AutoPostService();
    const publishedPosts = post.platformPosts?.filter((pp: any) => pp.status === 'published') || [];

    if (publishedPosts.length === 0) {
      return { success: true, data: [], cached: false };
    }

    const results = await Promise.all(publishedPosts.map(async (platformPost: any) => {
      const platform = platformPost.platformPostId || platformPost.platform;
      const platformData: any = {
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

        const latestCache = await db.query.entityDetails.findFirst({
          where: and(
            eq(entityDetails.entityId, postId),
            eq(entityDetails.entityType, ENTITY_TYPE)
          ),
          orderBy: [entityDetails.updatedAt],
        });

        const shouldFetch = !latestCache || dayjs().diff(dayjs(latestCache.updatedAt), 'hour') >= CACHE_TTL_HOURS;

        if (!shouldFetch && latestCache) {
          platformData.stats = latestCache.details;
          platformData.cached = true;
          platformData.updatedAt = latestCache.updatedAt;
          return platformData;
        }

        const insights = await trigger.getPostInsights({
          post,
          socialAccount: socialAccount as unknown as any,
          platform,
        });

        if (latestCache) {
          await db.update(entityDetails)
            .set({
              details: insights as unknown as Record<string, unknown>,
              updatedAt: dayjs().toDate(),
            })
            .where(eq(entityDetails.id, latestCache.id));
        } else {
          const id = crypto.randomUUID();
          await db.insert(entityDetails).values({
            id,
            entityId: postId,
            entityType: ENTITY_TYPE,
            details: insights as unknown as Record<string, unknown>,
            createdAt: dayjs().toDate(),
            updatedAt: dayjs().toDate(),
          });
        }

        platformData.stats = insights;
        platformData.cached = false;
        platformData.updatedAt = new Date().toISOString();
      } catch (err: any) {
        platformData.error = err.message || 'Failed to fetch stats';
      }

      return platformData;
    }));

    return { success: true, data: results };
  } catch (error: any) {
    if (error.statusCode) throw error;
    log.error({ content: 'Get all post stats error', error: String(error) });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
