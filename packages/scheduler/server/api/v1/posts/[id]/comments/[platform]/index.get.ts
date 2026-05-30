/**
 * GET /api/v1/posts/[id]/comments/[platform] - Get comments for a post on a specific platform
 *
 * Query params:
 *   - limit: number (default 25)
 *   - cursor: string (for pagination)
 */

import { postService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service';
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

    const { limit = '25', cursor } = getQuery(event);

    // Fetch the post with full data
    const post = await postService.findByIdFull({ postId });
    if (!post) {
      throw createError({ statusCode: 404, statusMessage: 'Post not found' });
    }

    // Find the platform post for this platform
    const platformPost = post.platformPosts?.find(
      (pp) => pp.platformPostId === platform || pp.platform === platform
    );

    if (!platformPost) {
      throw createError({ statusCode: 404, statusMessage: `No published post found for platform: ${platform}` });
    }

    // Get the social media account
    const socialAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId);
    if (!socialAccount) {
      throw createError({ statusCode: 404, statusMessage: 'Social media account not found' });
    }

    // Schedule post
    const trigger = new AutoPostService()
    const isSupportedPlatform = trigger.isSupportedPlatform(platform);

    if (!isSupportedPlatform) {
      throw createError({ statusCode: 400, statusMessage: `Unsupported platform: ${platform}` });
    }
    const result = await trigger.getCommentsFromPost({
      post, socialAccount: socialAccount as unknown as Account, platform, pagination:
        { limit: parseInt(limit as string, 10), cursor: cursor as string | undefined }
    });

    return { success: true, data: result };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    log.error({ content: 'Get comments error', error: String(error) });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
