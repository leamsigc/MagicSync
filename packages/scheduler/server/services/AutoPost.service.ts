import type { PostWithAllData } from '#layers/BaseDB/db/schema';
import { postService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService, type SocialMediaPlatform } from '#layers/BaseDB/server/services/social-media-account.service';
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
import { getAccessTokenHelper } from '#layers/BaseAuth/server/utils/AuthHelpers';
export class AutoPostService {

  private matcher: Record<string, SchedulerPluginConstructor> = {
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
  }

  async triggerSocialMediaPost(post: PostWithAllData): Promise<void> {
    // Implement the logic to trigger a social media post
    post.platformPosts.forEach(async (platformPost) => {
      const platform = platformPost.platformPostId
      if (!platform) {
        return;
      }
      const user = post.user;
      const accounts = await socialMediaAccountService.getAccountsForPlatform(
        platform,
        user.id
      )
      const scheduler = new SchedulerPost({
        post: post,
        accounts: accounts
      });
      const socialMediaAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId);
      if (!socialMediaAccount || !socialMediaAccount.accessToken) {
        throw new Error(`No access token found for platform ${platform}`);
      }
      //@ts-ignore
      scheduler.use(this.matcher[platform]);

      try {
        const response = await scheduler.publish(
          post,
          [],
          socialMediaAccount
        );

        await postService.updatePostBaseOnResponse(post, response, platformPost);
      } catch (e) {
        console.error(e);
        await postService.updatePostBaseOnResponse(
          post,
          { status: 'failed', id: platformPost.id, releaseURL: '', error: 'Post failed to post ', postId: post.id },
          platformPost
        );
      }
    });

  }
}
