/**
 * GET /api/v1/posts/[id]/comments/[platform] - Get comments for a post on a specific platform
 *
 * Query params:
 *   - limit: number (default 25)
 *   - cursor: string (for pagination)
 */

import { postService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { SchedulerPost } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { SchedulerPluginConstructor } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { FacebookPlugin } from '#layers/BaseScheduler/server/services/plugins/facebook.plugin';
import { BlueskyPlugin } from '#layers/BaseScheduler/server/services/plugins/bluesky.plugin';
import { DevToPlugin } from '#layers/BaseScheduler/server/services/plugins/devto.plugin';
import { DiscordPlugin } from '#layers/BaseScheduler/server/services/plugins/discord.plugin';
import { DribbblePlugin } from '#layers/BaseScheduler/server/services/plugins/dribbble.plugin';
import { GoogleMyBusinessPlugin } from '#layers/BaseScheduler/server/services/plugins/googlemybusiness.plugin';
import { InstagramPlugin } from '#layers/BaseScheduler/server/services/plugins/instagram.plugin';
import { InstagramStandalonePlugin } from '#layers/BaseScheduler/server/services/plugins/instagram-standalone.plugin';
import { LinkedInPlugin } from '#layers/BaseScheduler/server/services/plugins/linkedin.plugin';
import { LinkedInPagePlugin } from '#layers/BaseScheduler/server/services/plugins/linkedin-page.plugin';
import { RedditPlugin } from '#layers/BaseScheduler/server/services/plugins/reddit.plugin';
import { ThreadsPlugin } from '#layers/BaseScheduler/server/services/plugins/threads.plugin';
import { TikTokPlugin } from '#layers/BaseScheduler/server/services/plugins/tiktok.plugin';
import { WordPressPlugin } from '#layers/BaseScheduler/server/services/plugins/wordpress.plugin';
import { XPlugin } from '#layers/BaseScheduler/server/services/plugins/x.plugin';
import { YouTubePlugin } from '#layers/BaseScheduler/server/services/plugins/youtube.plugin';
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';

const pluginMatcher: Record<string, SchedulerPluginConstructor> = {
  facebook: FacebookPlugin as unknown as SchedulerPluginConstructor,
  bluesky: BlueskyPlugin as unknown as SchedulerPluginConstructor,
  devto: DevToPlugin as unknown as SchedulerPluginConstructor,
  discord: DiscordPlugin as unknown as SchedulerPluginConstructor,
  dribbble: DribbblePlugin as unknown as SchedulerPluginConstructor,
  googlemybusiness: GoogleMyBusinessPlugin as unknown as SchedulerPluginConstructor,
  instagram: InstagramPlugin as unknown as SchedulerPluginConstructor,
  'instagram-standalone': InstagramStandalonePlugin as unknown as SchedulerPluginConstructor,
  linkedin: LinkedInPlugin as unknown as SchedulerPluginConstructor,
  'linkedin-page': LinkedInPagePlugin as unknown as SchedulerPluginConstructor,
  reddit: RedditPlugin as unknown as SchedulerPluginConstructor,
  threads: ThreadsPlugin as unknown as SchedulerPluginConstructor,
  tiktok: TikTokPlugin as unknown as SchedulerPluginConstructor,
  wordpress: WordPressPlugin as unknown as SchedulerPluginConstructor,
  twitter: XPlugin as unknown as SchedulerPluginConstructor,
  youtube: YouTubePlugin as unknown as SchedulerPluginConstructor,
};

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
      (pp: any) => pp.platformPostId === platform || pp.platform === platform
    );

    if (!platformPost) {
      throw createError({ statusCode: 404, statusMessage: `No published post found for platform: ${platform}` });
    }

    // Get the social media account
    const socialAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId);
    if (!socialAccount) {
      throw createError({ statusCode: 404, statusMessage: 'Social media account not found' });
    }

    const PluginClass = pluginMatcher[platform];
    if (!PluginClass) {
      throw createError({ statusCode: 400, statusMessage: `Unsupported platform: ${platform}` });
    }

    const scheduler = new SchedulerPost({ post, accounts: [] });
    scheduler.use(PluginClass);

    const result = await scheduler.getComments(
      post as any,
      socialAccount as any,
      { limit: parseInt(limit as string, 10), cursor: cursor as string | undefined }
    );

    return { success: true, data: result };
  } catch (error: any) {
    if (error.statusCode) throw error;
    log.error({ content: 'Get comments error', error: String(error) });
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' });
  }
});
