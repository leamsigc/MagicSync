import type { PostResponse, } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { BaseSchedulerPlugin, } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import type { InstagramSettings } from '#layers/BaseScheduler/shared/platformSettings';
import { platformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';

export class InstagramPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'instagram';
  readonly pluginName = 'instagram';

  private normalizeContent(content: string): string {
    if (!content) return '';
    return content
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }

  private getPlatformData(postDetails: PostWithAllData, platformPost?: any) {
    const platformName = this.pluginName;
    const platformPostSettings = platformPost?.platformSettings || {};
    const platformContent = (postDetails as any).platformContent?.[platformName];
    const platformSettings = platformPostSettings ||
      (postDetails as any).platformSettings?.[platformName] as InstagramSettings | undefined;

    const rawContent = platformContent?.content || postDetails.content;
    const postFormat = platformSettings?.postFormat ||
      platformPostSettings?.postFormat ||
      (postDetails as any).postFormat || 'post';

    return {
      content: this.normalizeContent(rawContent),
      settings: platformSettings,
      postFormat: postFormat
    };
  }

  public override exposedMethods = [
    'instagramMaxLength',
    'getProfile',
    'getMediaInsights',
  ] as const;
  override maxConcurrentJob = platformConfigurations.instagram.maxConcurrentJob;

  instagramMaxLength() {
    return platformConfigurations.instagram.maxPostLength;
  }

  protected init(options?: any): void {
    console.log('Instagram plugin initialized', options);
  }

  override async validate(post: PostWithAllData): Promise<string[]> {
    const errors: string[] = [];

    if (!post.content || post.content.trim() === '') {
      errors.push('Post caption cannot be empty.');
    }

    if (post.content && post.content.length > platformConfigurations.instagram.maxPostLength) {
      errors.push(`Caption is too long (max ${platformConfigurations.instagram.maxPostLength} characters)`);
    }

    if (!post.assets || post.assets.length === 0) {
      errors.push('At least one image or video is required for Instagram posts.');
    }

    return Promise.resolve(errors);
  }

  /**
   * Get Instagram business account profile
   */
  async getProfile(accountId: string, accessToken: string): Promise<any> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${accountId}?fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.json();
  }

  /**
   * Get media insights (engagement metrics)
   */
  async getMediaInsights(mediaId: string, accessToken: string): Promise<any> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}/insights?metric=engagement,impressions,reach,saved`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.json();
  }

  /**
   * Create media container (step 1 of posting)
   */
  private async createContainer(
    igUserId: string,
    mediaUrl: string,
    caption: string,
    mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'STORIES',
    accessToken: string,
    children?: string[]
  ): Promise<string> {
    const params = new URLSearchParams({
      access_token: accessToken,
      caption: caption,
    });

    if (mediaType === 'CAROUSEL' && children && children.length > 0) {
      params.append('media_type', 'CAROUSEL');
      params.append('children', children.join(','));
    } else if (mediaType === 'VIDEO') {
      params.append('media_type', 'VIDEO');
      params.append('video_url', getPublicUrlForAsset(mediaUrl));
    } else if (mediaType === 'STORIES') {
      params.append('media_type', 'STORIES');
      params.append('image_url', getPublicUrlForAsset(mediaUrl)); // Stories support image_url or video_url, assuming image for now or need logic
      // If video story, we need video_url. Let's handle generic logic:
      if (mediaUrl.includes('.mp4') || mediaUrl.includes('video')) {
        params.delete('image_url');
        params.append('video_url', getPublicUrlForAsset(mediaUrl));
      }
    } else {
      params.append('image_url', getPublicUrlForAsset(mediaUrl));
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media?${params.toString()}`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram container creation failed: ${error}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Publish media container (step 2 of posting)
   */
  private async publishContainer(
    igUserId: string,
    containerId: string,
    accessToken: string
  ): Promise<any> {
    const params = new URLSearchParams({
      access_token: accessToken,
      creation_id: containerId,
    });

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media_publish?${params.toString()}`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram publish failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Wait for video processing to complete
   */
  private async waitForVideoProcessing(
    containerId: string,
    accessToken: string,
    maxAttempts: number = 30
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${containerId}?fields=status_code&access_token=${accessToken}`
      );
      const data = await response.json();

      if (data.status_code === 'FINISHED') {
        return;
      } else if (data.status_code === 'ERROR') {
        throw new Error('Video processing failed');
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Video processing timeout');
  }

  override async post(
    postDetails: PostWithAllData,
    comments: PostWithAllData[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const igUserId = socialMediaAccount.accountId;

      if (!igUserId) {
        throw new Error('Instagram Business Account ID is required');
      }

      if (!postDetails.assets || postDetails.assets.length === 0) {
        throw new Error('At least one media file is required');
      }

      const { content, settings, postFormat } = this.getPlatformData(postDetails);
      const caption = content || '';

      // Determine media type
      const hasVideo = postDetails.assets.some((asset: Asset) => asset.mimeType.includes('video'));
      const hasImage = postDetails.assets.some((asset: Asset) => asset.mimeType.includes('image'));
      const isStory = postFormat === 'story' || settings?.post_type === 'story';

      const firstAsset = postDetails.assets[0];
      const isVideoStory = isStory && firstAsset?.mimeType.includes('video');

      let containerId: string;

      if (isStory && !hasVideo && firstAsset) {
        const asset = postDetails.assets[0];
        containerId = await this.createContainer(
          igUserId,
          firstAsset.url,
          caption,
          'STORIES',
          socialMediaAccount.accessToken
        );
      } else if (postDetails.assets.length > 1 && !hasVideo) {
        // Carousel post (multiple images)
        const childContainers: string[] = [];

        for (const asset of postDetails.assets.slice(0, 10)) {
          if (asset.mimeType.includes('image')) {
            const childId = await this.createContainer(
              igUserId,
              asset.url,
              '',
              'IMAGE',
              socialMediaAccount.accessToken
            );
            childContainers.push(childId);
          }
        }

        containerId = await this.createContainer(
          igUserId,
          '',
          caption,
          'CAROUSEL',
          socialMediaAccount.accessToken,
          childContainers
        );
      } else if (hasVideo) {
        // Single video post (Reel)
        const videoAsset = postDetails.assets.find((asset: Asset) => asset.mimeType.includes('video'));
        if (!videoAsset) {
          throw new Error('Video asset not found');
        }

        containerId = await this.createContainer(
          igUserId,
          videoAsset.url,
          caption,
          'VIDEO',
          socialMediaAccount.accessToken
        );

        // Wait for video processing
        await this.waitForVideoProcessing(containerId, socialMediaAccount.accessToken);
      } else {
        // Single image post
        const imageAsset = postDetails.assets[0];
        containerId = await this.createContainer(
          igUserId,
          imageAsset?.url || '',
          caption,
          'IMAGE',
          socialMediaAccount.accessToken
        );
      }

      // Publish the container
      const publishedData = await this.publishContainer(
        igUserId,
        containerId,
        socialMediaAccount.accessToken
      );

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: publishedData.id,
        releaseURL: `https://www.instagram.com/p/${publishedData.id}/`,
        status: 'published',
      };

      this.emit('instagram:post:published', { postId: postResponse.postId, response: publishedData });
      return postResponse;
    } catch (error: unknown) {
      this.logPluginEvent('instagram:post-error', 'failure', (error as Error).message);
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('instagram:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async update(
    postDetails: PostWithAllData,
    comments: PostWithAllData[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    const publishedPlatformDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
    if (!publishedPlatformDetails) {
      throw new Error('Published platform details not found');
    }

    const publishedDetails = publishedPlatformDetails.publishDetail ? JSON.parse(publishedPlatformDetails.publishDetail as string) as PostResponse : null;
    if (!publishedDetails) {
      throw new Error('Published details not found');
    }
    const publishedPostId = publishedDetails.postId;

    // Update caption
    const { content } = this.getPlatformData(postDetails);

    // https://graph.facebook.com/{media-id}?caption={caption}
    const params = new URLSearchParams({
      access_token: socialMediaAccount.accessToken,
      caption: content || '',
    });

    const response = await fetch(`https://graph.facebook.com/v18.0/${publishedPostId}?${params.toString()}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram update failed: ${error}`);
    }

    const responseData = await response.json();

    const postResponse: PostResponse = {
      id: postDetails.id,
      postId: publishedPostId,
      releaseURL: publishedDetails.releaseURL,
      status: 'published',
    };

    this.emit('instagram:post:updated', { postId: publishedPostId, response: responseData });
    return postResponse;
  }

  async getStatistic(
    postDetails: PostWithAllData,
    socialMediaAccount: SocialMediaAccount
  ): Promise<any> {
    const publishedPlatformDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
    if (!publishedPlatformDetails) {
      throw new Error('Published platform details not found');
    }

    const publishedDetails = publishedPlatformDetails.publishDetail ? JSON.parse(publishedPlatformDetails.publishDetail as string) as PostResponse : null;
    if (!publishedDetails) {
      throw new Error('Published details not found');
    }
    const publishedPostId = publishedDetails.postId;

    // Use existing helper
    return this.getMediaInsights(publishedPostId, socialMediaAccount.accessToken);
  }

  override async addComment(
    postDetails: PostWithAllData,
    commentDetails: PostWithAllData,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      // Get the post id from the publishDetails
      const publishedPlatformDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);

      if (!publishedPlatformDetails) {
        throw new Error('Published platform details not found');
      }
      const details = JSON.parse(publishedPlatformDetails.publishDetail as unknown as string || '{}') as PostResponse;
      const postId = details.postId;
      if (!postId) {
        throw new Error('Post details not found');
      }

      const params = new URLSearchParams({
        access_token: socialMediaAccount.accessToken,
        message: commentDetails.content,
      });

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${postId}/comments?${params.toString()}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Instagram comment failed: ${error}`);
      }

      const data = await response.json();

      const commentResponse: PostResponse = {
        id: commentDetails.id,
        postId: data.id,
        releaseURL: `https://www.instagram.com/p/${postId}/`,
        status: 'published',
      };

      this.emit('instagram:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
      return commentResponse;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: commentDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('instagram:comment:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }
}
