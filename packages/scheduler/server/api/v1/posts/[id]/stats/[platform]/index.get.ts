/**
 * GET /api/v1/posts/[id]/stats/[platform] - Get post insights for a specific platform
 *
 * Uses cached data if entityDetails (social_media_post_stats) was updated within 1 hour.
 * Otherwise fetches fresh data from the platform API and saves to entityDetails.
 */

import { postService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails';
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service';
import { eq, and, desc } from 'drizzle-orm';
import dayjs from 'dayjs';

const ENTITY_TYPE = 'social_media_post_stats';
const CACHE_TTL_HOURS = 1;

export default defineEventHandler(async (event) => {
  const log = useLogger(event);
  const db = useDrizzle();

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

    const post = await postService.findByIdFull({ postId });
    if (!post) {
      throw createError({ statusCode: 404, statusMessage: 'Post not found' });
    }

    const platformPost = post.platformPosts?.find(
      (pp: any) => pp.platformPostId === platform || pp.platform === platform
    );

    if (!platformPost) {
      throw createError({ statusCode: 404, statusMessage: `No published post found for platform: ${platform}` });
    }

    const socialAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId);
    if (!socialAccount) {
      throw createError({ statusCode: 404, statusMessage: 'Social media account not found' });
    }

    const latestCache = await db.query.entityDetails.findFirst({
      where: and(
        eq(entityDetails.entityId, postId),
        eq(entityDetails.entityType, ENTITY_TYPE)
      ),
      orderBy: desc(entityDetails.updatedAt),
    });

    if (latestCache) {
      const cacheAge = dayjs().diff(dayjs(latestCache.updatedAt), 'hour');
      if (cacheAge < CACHE_TTL_HOURS) {
        return { success: true, data: latestCache.details, cached: true, updatedAt: latestCache.updatedAt };
      }
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

    return { success: true, data: insights, cached: false, updatedAt: new Date().toISOString() };
  } catch (error: any) {
    if (error.statusCode) throw error;
    log.error({ content: 'Get post stats error', error: String(error) });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
