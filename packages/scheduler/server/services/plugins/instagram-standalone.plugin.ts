import type { PostResponse, Integration, PluginPostDetails, PluginSocialMediaAccount } from '../SchedulerPost.service';
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
  override getStatistic(postDetails: PluginPostDetails, socialMediaAccount: PluginSocialMediaAccount): Promise<any> {
    throw new Error('Method not implemented.');
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
}
