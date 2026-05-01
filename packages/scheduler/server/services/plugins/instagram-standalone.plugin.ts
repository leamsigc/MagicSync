import type { PostResponse, Integration, PluginPostDetails, PluginSocialMediaAccount, GetCommentsResponse, ReplyCommentResponse, PlatformComment, PlatformStats } from '../SchedulerPost.service';
import { BaseSchedulerPlugin } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount } from '#layers/BaseDB/db/schema';

/**
 * Instagram Standalone Plugin - Uses Instagram Basic Display API
 * NOTE: Instagram Basic Display API was deprecated on December 4, 2024
 * This plugin is kept for legacy compatibility only
 * Users should migrate to the main instagram.plugin.ts (Graph API)
 */
import { platformConfigurations } from '../../../shared/platformConstants';

export class InstagramStandalonePlugin extends BaseSchedulerPlugin {
  override async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    const { accessToken, accountId, accountName } = socialMediaAccount;

    try {
      // 1. Fetch basic account info
      const basicUrl = `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${accessToken}`;
      const basicRes = await fetch(basicUrl);

      if (!basicRes.ok) {
        console.warn(`Instagram-standalone basic info API error: ${basicRes.status} ${basicRes.statusText}`);
        return this.getZeroStats(accountId, accountName);
      }

      const basic: { id?: string; username?: string; account_type?: string; media_count?: number } = await basicRes.json();
      const igId = basic.id || accountId;

      // 2. Fetch insights (follower_count, impressions, reach, engagement)
      let followers = 0;
      let impressions = 0;
      let reach = 0;
      let engagement = 0;

      try {
        const insightsUrl = `https://graph.instagram.com/${igId}/insights?metric=follower_count,impressions,reach,engagement&access_token=${accessToken}`;
        const insightsRes = await fetch(insightsUrl);

        if (insightsRes.ok) {
          const insights: { data?: Array<{ name: string; values: Array<{ value: number }> }> } = await insightsRes.json();

          for (const metric of insights.data || []) {
            const value = metric.values?.[0]?.value ?? 0;
            switch (metric.name) {
              case 'follower_count':
                followers = value;
                break;
              case 'impressions':
                impressions = value;
                break;
              case 'reach':
                reach = value;
                break;
              case 'engagement':
                engagement = value;
                break;
            }
          }
        }
      } catch (insightsErr) {
        console.warn('Instagram-standalone insights fetch failed, using zero fallback:', insightsErr);
      }

      return {
        platform: 'instagram-standalone',
        accountId: igId,
        username: basic.username || accountName || accountId,
        fetchedAt: new Date().toISOString(),
        posts: basic.media_count || 0,
        followers,
        engagement: {
          total: engagement,
          impressions,
          reach,
        },
        extra: {
          account_type: basic.account_type,
        },
      };
    } catch (error) {
      console.error('Instagram-standalone getStatistic error:', error);
      return this.getZeroStats(accountId, accountName);
    }
  }

  private getZeroStats(accountId: string, accountName?: string): PlatformStats {
    return {
      platform: 'instagram-standalone',
      accountId,
      username: accountName || accountId,
      fetchedAt: new Date().toISOString(),
      followers: 0,
      following: 0,
      posts: 0,
      engagement: {
        total: 0,
        impressions: 0,
        reach: 0,
      },
    };
  }
  static readonly pluginName = 'instagram-standalone';
  readonly pluginName = 'instagram-standalone';
  public override exposedMethods = [
    'instagramMaxLength',
  ] as const;
  override maxConcurrentJob = platformConfigurations['instagram-standalone'].maxConcurrentJob;

  instagramMaxLength() {
    return platformConfigurations['instagram-standalone'].maxPostLength;
  }

  protected init(options?: any): void {
    console.warn(
      'WARNING: Instagram Basic Display API was deprecated on December 4, 2024. ' +
      'Please use the Instagram Graph API plugin instead (instagram.plugin.ts)'
    );
  }

  override async validate(post: Post): Promise<string[]> {
    return Promise.resolve([
      'Instagram Basic Display API was deprecated on December 4, 2024. ' +
      'This plugin no longer works. Please use the Instagram Graph API plugin instead.',
    ]);
  }

  /**
   * Get user's media list (read-only)
   */
  async getMediaList(accessToken: string): Promise<any> {
    const response = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${accessToken}`
    );
    return response.json();
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    // Instagram Basic Display API is read-only and has been deprecated
    const errorResponse: PostResponse = {
      id: postDetails.id,
      postId: '',
      releaseURL: '',
      status: 'failed',
      error:
        'Instagram Basic Display API was deprecated on December 4, 2024, and does not support posting. ' +
        'Please use the Instagram Graph API plugin (instagram.plugin.ts) with an Instagram Business account instead.',
    };
    this.emit('instagram-standalone:post:failed', {
      error: 'Instagram Basic Display API deprecated and read-only'
    });
    return Promise.resolve(errorResponse);
  }

  override async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    return this.post(postDetails, comments, socialMediaAccount);
  }

  override async addComment(
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    const errorResponse: PostResponse = {
      id: commentDetails.id,
      postId: '',
      releaseURL: '',
      status: 'failed',
      error: 'Instagram Basic Display API was deprecated and does not support commenting.',
    };
    this.emit('instagram-standalone:comment:failed', {
      error: 'Instagram Basic Display API deprecated'
    });
    return Promise.resolve(errorResponse);
  }

  /**
   * Get comments for an Instagram standalone post
   * Note: Instagram standalone does not support comments API
   */
  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    return Promise.resolve({
      platform: this.pluginName,
      postId: '',
      comments: [],
      hasMore: false,
    });
  }

  /**
   * Reply to a comment on Instagram standalone
   * Note: Instagram standalone does not support comments API
   */
  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    return {
      success: false,
      error: 'Instagram standalone does not support comments API',
    };
  }
}
