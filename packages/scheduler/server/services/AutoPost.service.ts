import type { Post, PostWithAllData, Account } from '#layers/BaseDB/db/schema';
import { postBatchService } from '#layers/BaseDB/server/services/post.service';
import { socialMediaAccountService, } from '#layers/BaseDB/server/services/social-media-account.service';
import { SchedulerPos, SchedulerPost } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { PluginPostDetails, PluginSocialMediaAccount, SchedulerPluginConstructor } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
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
import { PinterestPlugin } from '#layers/BaseScheduler/server/services/plugins/pinterest.plugin';
import { platformRateLimiter } from './RateLimiter.service';
import { auth } from '#layers/BaseAuth/lib/auth';
import { notificationService } from '#layers/BaseAuth/server/services/notification.service';
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
    pinterest: PinterestPlugin as unknown as SchedulerPluginConstructor,
    youtube: YouTubePlugin as unknown as SchedulerPluginConstructor,
  }

  private async notifyPostFailed(post: PostWithAllData, platform: string, error: string) {
    try {
      await notificationService.notify({
        userId: post.user.id,
        event: 'post_failed',
        type: 'error',
        title: 'Post failed to publish',
        message: `Your post failed on ${platform}. ${error}`.slice(0, 500),
        actionUrl: '/app/posts?status=failed',
        metadata: { postId: post.id, platform },
      })
    } catch {
      // Notifications must never break publishing
    }
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
          const retryResult = await postBatchService.scheduleRetry(
            post.id,
            post.retryCount ?? 0,
            `Rate limited on platform '${platform}'. Retry after ${Math.round((rateCheck.retryAfterMs ?? 0) / 1000)}s.`
          )
          if (retryResult.code === 'RETRY_EXHAUSTED') {
            await this.notifyPostFailed(post, platform, 'Rate limited — retries exhausted.')
          }
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
        let socialMediaAccount = await socialMediaAccountService.getAccountById(platformPost.socialAccountId)
        if (!socialMediaAccount || !socialMediaAccount.accessToken) {
          const err = `No access token found for platform ${platform}`
          console.error(`[AutoPost] ${err} | Post ID: ${post.id}`)
          const retryResult = await postBatchService.scheduleRetry(post.id, post.retryCount ?? 0, err)
          if (retryResult.code === 'RETRY_EXHAUSTED') {
            await this.notifyPostFailed(post, platform, err)
          }
          return
        }
        // Refresh the access token via Better Auth before posting.
        // Better Auth resolves strictly by its own account row id — passing
        // our social_media_accounts id (or the provider account id) yields
        // ACCOUNT_NOT_FOUND, so resolve the row first.
        try {
          const resolved = await socialMediaAccountService.findBetterAuthAccountForRefresh(
            socialMediaAccount.userId,
            platform
          )
          const providerAccount = resolved.success ? resolved.data : null
          if (!providerAccount) {
            throw new Error('No linked provider account found for refresh')
          }
          // No `headers`: passing even empty Headers makes Better Auth treat
          // this as an HTTP caller and throw UNAUTHORIZED with no session.
          // Omitting them marks it a trusted server-side call, and the
          // explicit userId below is then accepted (see resolveUserId).
          const tokenResp = await auth.api.getAccessToken({
            body: {
              accountId: providerAccount.id,
              userId: socialMediaAccount.userId,
            },
          })
          const freshToken = (tokenResp as any)?.accessToken
          const expiresAt = (tokenResp as any)?.accessTokenExpiresAt
          if (freshToken && freshToken !== socialMediaAccount.accessToken) {
            // Mirror the renewed token onto our row — otherwise plugins keep
            // using the stale expired token and every publish fails.
            await socialMediaAccountService.updateAccount(socialMediaAccount.id, {
              accessToken: freshToken,
              lastSyncAt: new Date(),
              ...(expiresAt ? { tokenExpiresAt: new Date(expiresAt) } : {}),
            })
            socialMediaAccount.accessToken = freshToken
          } else if (freshToken) {
            // Token still valid — update lastSyncAt and expiry if provided
            await socialMediaAccountService.updateAccount(socialMediaAccount.id, {
              lastSyncAt: new Date(),
              ...(expiresAt ? { tokenExpiresAt: new Date(expiresAt) } : {}),
            })
          }
        } catch (tokenRefreshError) {
          console.warn(`[AutoPost] Token refresh via Better Auth failed for ${platform} | Post ID: ${post.id}`, tokenRefreshError)
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
          if (response.status === 'failed') {
            await this.notifyPostFailed(post, platform, response.error || 'Publish failed.')
          }
        } catch (e) {
          console.error(e);
          await postBatchService.updatePostBaseOnResponse(
            post,
            { status: 'failed', id: platformPost.id, releaseURL: '', error: 'Post failed to post ', postId: post.id },
            platformPost
          );
          await this.notifyPostFailed(post, platform, e instanceof Error ? e.message : 'Publish threw an error.')
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

    return await scheduler.getComments(post, socialAccount as unknown as PluginSocialMediaAccount, pagination);

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
      socialAccount as unknown as PluginSocialMediaAccount,
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

    return await scheduler.getPostInsights(post, socialAccount as unknown as PluginSocialMediaAccount);
  }

  async getStatisticForAccount({
    platform,
    account,
  }: {
    platform: string;
    account: Account;
  }) {
    const scheduler = new SchedulerPost({
      post: undefined as unknown as Post,
      accounts: [account],
    });

    const plugin = this.matcher[platform];
    if (!plugin) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    scheduler.use(plugin);

    return await scheduler.getStatistic({} as unknown as PluginPostDetails, account as unknown as PluginSocialMediaAccount);
  }

  async likeComment({
    post,
    socialAccount,
    platform,
    commentId,
  }: {
    post: PostWithAllData;
    socialAccount: Account;
    platform: string;
    commentId: string;
  }) {
    const scheduler = new SchedulerPost({ post, accounts: [socialAccount] });
    const plugin = this.matcher[platform];
    if (!plugin) throw new Error(`Unsupported platform: ${platform}`);
    scheduler.use(plugin);
    return await scheduler.likeComment(post, socialAccount as unknown as PluginSocialMediaAccount, commentId);
  }

  async hideComment({
    post,
    socialAccount,
    platform,
    commentId,
    isHidden,
  }: {
    post: PostWithAllData;
    socialAccount: Account;
    platform: string;
    commentId: string;
    isHidden: boolean;
  }) {
    const scheduler = new SchedulerPost({ post, accounts: [socialAccount] });
    const plugin = this.matcher[platform];
    if (!plugin) throw new Error(`Unsupported platform: ${platform}`);
    scheduler.use(plugin);
    return await scheduler.hideComment(post, socialAccount as unknown as PluginSocialMediaAccount, commentId, isHidden);
  }

  async deleteComment({
    post,
    socialAccount,
    platform,
    commentId,
  }: {
    post: PostWithAllData;
    socialAccount: Account;
    platform: string;
    commentId: string;
  }) {
    const scheduler = new SchedulerPost({ post, accounts: [socialAccount] });
    const plugin = this.matcher[platform];
    if (!plugin) throw new Error(`Unsupported platform: ${platform}`);
    scheduler.use(plugin);
    return await scheduler.deleteComment(post, socialAccount as unknown as PluginSocialMediaAccount, commentId);
  }

  private dmCapablePlatforms = new Set(['facebook', 'instagram']);

  supportsDMs(platform: string) {
    return this.dmCapablePlatforms.has(platform);
  }

  async getConversations({
    socialAccount,
    platform,
    limit,
    cursor,
  }: {
    socialAccount: Account;
    platform: string;
    limit?: number;
    cursor?: string;
  }) {
    const scheduler = new SchedulerPost({
      post: undefined as unknown as Post,
      accounts: [socialAccount],
    });
    const plugin = this.matcher[platform];
    if (!plugin) throw new Error(`Unsupported platform: ${platform}`);
    scheduler.use(plugin);
    return await scheduler.getConversations(
      socialAccount as unknown as PluginSocialMediaAccount,
      { limit, cursor },
    );
  }

  async replyToConversation({
    socialAccount,
    platform,
    conversationId,
    message,
  }: {
    socialAccount: Account;
    platform: string;
    conversationId: string;
    message: string;
  }) {
    const scheduler = new SchedulerPost({
      post: undefined as unknown as Post,
      accounts: [socialAccount],
    });
    const plugin = this.matcher[platform];
    if (!plugin) throw new Error(`Unsupported platform: ${platform}`);
    scheduler.use(plugin);
    return await scheduler.replyToConversation(
      socialAccount as unknown as PluginSocialMediaAccount,
      conversationId,
      message,
    );
  }
}
