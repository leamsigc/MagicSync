import { postService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { AutoPostService } from '#layers/BaseScheduler/server/services/AutoPost.service';
import { readValidatedBody } from 'h3';
import { z } from 'zod';

const BodySchema = z.object({
  commentId: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const log = useLogger(event);
  try {
    const user = await checkUserIsLogin(event);
    const postId = getRouterParam(event, 'id');
    const platform = getRouterParam(event, 'platform');

    if (!postId || !platform) {
      throw createError({ statusCode: 400, statusMessage: 'Post ID and platform are required' });
    }

    const body = await readValidatedBody(event, BodySchema.parse);
    const post = await postService.findByIdFull({ postId, userId: user.id });
    if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found' });

    const platformPost = post.platformPosts?.find(
      (pp) => pp.platformPostId === platform || pp.platform === platform
    );
    if (!platformPost) throw createError({ statusCode: 404, statusMessage: `No published post found for platform: ${platform}` });

    const socialAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId);
    if (!socialAccount) throw createError({ statusCode: 404, statusMessage: 'Social media account not found' });

    const trigger = new AutoPostService();
    if (!trigger.isSupportedPlatform(platform)) throw createError({ statusCode: 400, statusMessage: `Unsupported platform: ${platform}` });

    const result = await trigger.deleteComment({ post, socialAccount, platform, commentId: body.commentId });
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    log.error({ content: 'Delete comment error', error: String(error) });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
