import type { PostWithAllData, Account } from '#layers/BaseDB/db/schema';
import { postBatchService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService, } from '#layers/BaseDB/server/services/social-media-account.service';
import { SchedulerPos, SchedulerPost } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
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
import { platformRateLimiter } from './RateLimiter.service';
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
    await Promise.all(
      post.platformPosts.map(async (platformPost) => {
        const platform = platformPost.platformPostId
        if (!platform) return

        // Check rate limit before attempting to publish
        const rateCheck = platformRateLimiter.canMakeRequest(platform)
        if (!rateCheck.allowed) {
          console.warn(
            `[RateLimit] Platform '${platform}' is rate-limited. ` +
            `Retry in ${Math.round((rateCheck.retryAfterMs ?? 0) / 1000)}s. ` +
            `Post ID: ${post.id}`
          )
          await postBatchService.scheduleRetry(
            post.id,
            post.retryCount ?? 0,
            `Rate limited on platform '${platform}'. Retry after ${Math.round((rateCheck.retryAfterMs ?? 0) / 1000)}s.`
          )
          return
        }

        const user = post.user
        const accounts = await socialMediaAccountService.getAccountsForPlatform(
          platform,
          user.id
        )
        const scheduler = new SchedulerPost({
          post: post,
          accounts: accounts
        })
        const socialMediaAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId)
        if (!socialMediaAccount || !socialMediaAccount.accessToken) {
          const err = `No access token found for platform ${platform}`
          console.error(`[AutoPost] ${err} | Post ID: ${post.id}`)
          await postBatchService.scheduleRetry(post.id, post.retryCount ?? 0, err)
          return
        }
        // @ts-ignore - dynamic plugin resolution
        const plugin = this.matcher[platform];
        if (!plugin) {
          throw new Error(`Unsupported platform: ${platform}`);
        }
        scheduler.use(plugin);

        try {
          const response = await scheduler.publish(
            post,
            [],
            socialMediaAccount
          );

          await postBatchService.updatePostBaseOnResponse(post, response, platformPost);
        } catch (e) {
          console.error(e);
          await postBatchService.updatePostBaseOnResponse(
            post,
            { status: 'failed', id: platformPost.id, releaseURL: '', error: 'Post failed to post ', postId: post.id },
            platformPost
          );
        }
      }))
  }

  async getCommentsFromPost({
    post,
    socialAccount,
    platform,
    pagination

  }: {
    post: PostWithAllData;
    socialAccount: Account[];
    platform: string;
    pagination: { limit: number; cursor: string | undefined; };
  }) {
    const scheduler = new SchedulerPost({
      post,
      accounts: socialAccount,
    });

    const plugin = this.matcher[platform];
    if (!plugin) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    scheduler.use(plugin);

    return await scheduler.getComments(post, socialAccount as any, pagination);

  }

  isSupportedPlatform(platform: string) {
    return platform in this.matcher
  }

  async replyToComment({
    post,
    socialAccount,
    platform,
    commentId,
    replyText,
  }: {
    post: PostWithAllData;
    socialAccount: Account;
    platform: string;
    commentId: string;
    replyText: string;
  }) {
    const scheduler = new SchedulerPost({
      post,
      accounts: [socialAccount],
    });

    const plugin = this.matcher[platform];
    if (!plugin) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    scheduler.use(plugin);

    return await scheduler.replyToComment(
      post,
      socialAccount as any,
      commentId,
      replyText
    );
  }

  async getPostInsights({
    post,
    socialAccount,
    platform,
  }: {
    post: PostWithAllData;
    socialAccount: Account;
    platform: string;
  }) {
    const scheduler = new SchedulerPost({
      post,
      accounts: [socialAccount],
    });

    const plugin = this.matcher[platform];
    if (!plugin) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    scheduler.use(plugin);

    return await scheduler.getPostInsights(post, socialAccount as any);
  }

  async getStatisticForAccount({
    platform,
    account,
  }: {
    platform: string;
    account: Account;
  }) {
    const scheduler = new SchedulerPost({
      post: undefined as any,
      accounts: [account],
    });

    const plugin = this.matcher[platform];
    if (!plugin) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    scheduler.use(plugin);

    return await scheduler.getStatistic({} as any, account as any);
  }
}
