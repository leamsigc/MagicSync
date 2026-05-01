import type { PostResponse, GetCommentsResponse, ReplyCommentResponse, PlatformComment } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { BaseSchedulerPlugin, type PlatformStats } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
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
    const platformContent = (postDetails.platformContent as any)[platformName];
    const platformSettings = (postDetails.platformSettings as any)[platformName] as InstagramSettings | undefined;
    const rawContent = platformContent?.content || postDetails.content;
    const postFormat = (postDetails as any).postFormat || 'post';
    const comments = platformContent?.comments || [];
    return {
      content: this.normalizeContent(rawContent),
      settings: platformSettings,
      postFormat: postFormat,
      comments
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
      `https://graph.facebook.com/v21.0/${accountId}?fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count`,
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
      `https://graph.facebook.com/v21.0/${mediaId}/insights?metric=views,reach,saved,likes,comments,shares`,
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
    mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'STORIES' | 'REELS',
    accessToken: string,
    children?: string[],
    settings?: any,
    isCarouselItem?: boolean
  ): Promise<string> {
    const params = new URLSearchParams({
      access_token: accessToken,
    });

    if (caption) {
      params.append('caption', caption);
    }

    if (isCarouselItem) {
      params.append('is_carousel_item', 'true');
    }

    if (mediaType === 'CAROUSEL' && children && children.length > 0) {
      params.append('media_type', 'CAROUSEL');
      params.append('children', children.join(','));
    } else if (mediaType === 'VIDEO' || mediaType === 'REELS') {
      params.append('media_type', mediaType);
      params.append('video_url', getPublicUrlForAsset(mediaUrl));

      if (mediaType === 'REELS' && settings?.is_trial_reel) {
        params.append('trial_params', JSON.stringify({
          graduation_strategy: settings?.graduation_strategy || 'MANUAL'
        }));
      }
    } else if (mediaType === 'STORIES') {
      params.append('media_type', 'STORIES');
      if (mediaUrl.match(/\.(mp4|mov|wmv|flv|avi)$/i) || mediaUrl.includes('video')) {
        params.append('video_url', getPublicUrlForAsset(mediaUrl));
      } else {
        params.append('image_url', getPublicUrlForAsset(mediaUrl));
      }
    } else {
      params.append('image_url', getPublicUrlForAsset(mediaUrl));
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}/media?${params.toString()}`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Instagram container creation failed: ${error}`);
    }

    const data = await response.json();
    log.info({ content: 'Instagram container created', plugin: 'instagram', containerData: data })
    return data.id;
  }

  /**
   * Publish media container (step 2 of posting)
   */
  private async publishContainer(
    igUserId: string,
    containerId: string,
    accessToken: string,
    retries: number = 5
  ): Promise<any> {
    const params = new URLSearchParams({
      access_token: accessToken,
      creation_id: containerId,
    });

    for (let i = 0; i < retries; i++) {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media_publish?${params.toString()}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) { }

        // Error 2207027: The media is not ready for publishing, please wait for a moment
        if (errorData?.error?.error_subcode === 2207027 && i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        throw new Error(`Instagram publish failed: ${errorText}`);
      }

      return response.json();
    }
  }

  /**
   * Wait for media processing to complete
   */
  private async waitForMediaProcessing(
    containerId: string,
    accessToken: string,
    maxAttempts: number = 30
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      let response;
      try {
        response = await fetch(
          `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`
        );
      } catch (err) {
        // network error, let's keep waiting
      }

      if (response && response.ok) {
        const data = await response.json();

        if (data.status_code === 'FINISHED') {
          return;
        } else if (data.status_code === 'ERROR') {
          throw new Error('Media processing failed');
        } else if (!data.status_code) {
          // Status code might not be present for generic images or some types, so return and check publishing.
          return;
        }
      }

      // Wait 3 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    throw new Error('Media processing timeout');
  }

  override async post(
    postDetails: PostWithAllData,
    comments: PostWithAllData[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    log.info({ content: 'Instagram post started', plugin: 'instagram' })
    try {
      log.info({ content: 'Instagram post details', plugin: 'instagram', postDetails })
      const igUserId = socialMediaAccount.accountId;

      if (!igUserId) {
        throw new Error('Instagram Business Account ID is required');
      }

      if (!postDetails.assets || postDetails.assets.length === 0) {
        throw new Error('At least one media file is required');
      }

      const { content, settings, postFormat, comments: postComments } = this.getPlatformData(postDetails);
      const caption = content || '';

      const isStory = postFormat === 'story' || settings?.post_type === 'story';

      log.info({ content: 'Instagram is story check', plugin: 'instagram', isStory })
      let containerId: string;
      let lastPublishedData: any = null;

      if (isStory) {
        for (const asset of postDetails.assets) {
          const cid = await this.createContainer(
            igUserId,
            asset.url,
            asset.originalName, // stories caption doesn't map directly to media caption
            'STORIES',
            socialMediaAccount.accessToken,
            undefined,
            settings
          );

          await this.waitForMediaProcessing(cid, socialMediaAccount.accessToken);

          lastPublishedData = await this.publishContainer(
            igUserId,
            cid,
            socialMediaAccount.accessToken
          );
        }

        const postResponse: PostResponse = {
          id: postDetails.id,
          postId: lastPublishedData.id,
          releaseURL: `https://www.instagram.com/p/${lastPublishedData.id}/`,
          status: 'published',
        };
        this.emit('instagram:post:published', { postId: postResponse.postId, response: lastPublishedData });
        return postResponse;
      } else if (postDetails.assets.length > 1) {
        // Carousel post (multiple images or mixed)
        const childContainers: string[] = [];

        for (const asset of postDetails.assets.slice(0, 10)) {
          const mediaType = asset.mimeType.includes('video') ? 'VIDEO' : 'IMAGE';
          const childId = await this.createContainer(
            igUserId,
            asset.url,
            '', // Provide empty string for children caption
            mediaType,
            socialMediaAccount.accessToken,
            undefined,
            settings,
            true // isCarouselItem
          );

          await this.waitForMediaProcessing(childId, socialMediaAccount.accessToken);
          childContainers.push(childId);
        }

        containerId = await this.createContainer(
          igUserId,
          '',
          caption,
          'CAROUSEL',
          socialMediaAccount.accessToken,
          childContainers,
          settings
        );
      } else {
        // Single image or video post
        log.info({ content: 'Instagram regular post', plugin: 'instagram' })


        const asset = postDetails.assets[0];
        if (!asset) {
          throw new Error('No asset found for post');
        }


        const isVid = asset.mimeType.includes('video');
        const mediaType = isVid ? 'REELS' : 'IMAGE';

        containerId = await this.createContainer(
          igUserId,
          asset.url,
          caption,
          mediaType,
          socialMediaAccount.accessToken,
          undefined,
          settings
        );
      }
      log.info({ content: 'Instagram container ID obtained', plugin: 'instagram', containerId })

      if (!isStory) {
        await this.waitForMediaProcessing(containerId, socialMediaAccount.accessToken);

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
      }

      throw new Error('Unknown posting error');
    } catch (error: unknown) {
      log.error({ content: 'Instagram post failed', plugin: 'instagram', error: (error as Error).message })

      this.logPluginEvent('post-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id, {
        error: `${error}`,
      });
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

    const response = await fetch(`https://graph.facebook.com/v21.0/${publishedPostId}?${params.toString()}`, {
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
  ): Promise<PlatformStats> {
    const igUserId = socialMediaAccount.accountId

    // Fetch account-level profile stats (followers, following, media_count)
    const profile = await this.getProfile(igUserId, socialMediaAccount.accessToken)

    // Fetch latest media for engagement stats
    let totalEngagement = 0
    let totalViews = 0
    let totalPosts = 0

    try {
      const mediaUrl = `https://graph.facebook.com/v21.0/${igUserId}/media?fields=id,caption,media_type,like_count,comments_count,views&limit=50&access_token=${socialMediaAccount.accessToken}`
      const mediaResponse = await fetch(mediaUrl)
      const mediaData = await mediaResponse.json()
      const mediaItems = mediaData.data || []

      totalPosts = mediaItems.length

      for (const media of mediaItems) {
        totalEngagement += (media.like_count || 0) + (media.comments_count || 0)
        totalViews += media.views || 0
      }
    } catch {
      // Media fetch failed — proceed with profile data only
    }

    // Fetch 7-day follower change if available
    let followerGrowth = undefined
    try {
      const insightsUrl = `https://graph.facebook.com/v21.0/${igUserId}/insights?metric=follower_count&access_token=${socialMediaAccount.accessToken}`
      const insightsResponse = await fetch(insightsUrl)
      const insightsData = await insightsResponse.json()
      const values = insightsData.data?.[0]?.values || []
      if (values.length >= 2) {
        const current = values[values.length - 1].value
        const previous = values[0].value
        const absolute = current - previous
        const percentage = previous > 0 ? Math.round((absolute / previous) * 10000) / 100 : 0
        followerGrowth = { absolute, percentage }
      }
    } catch {
      // Insights not available
    }

    return {
      platform: 'instagram',
      accountId: igUserId,
      username: profile.username || socialMediaAccount.accountName || '',
      picture: profile.profile_picture_url || undefined,
      fetchedAt: new Date().toISOString(),
      followers: profile.followers_count,
      following: profile.follows_count,
      posts: profile.media_count || totalPosts,
      engagement: {
        total: totalEngagement,
        likes: totalEngagement,
        comments: 0,
        views: totalViews,
      },
      growth: {
        followers: followerGrowth,
      },
      extra: {
        name: profile.name,
      },
    }
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
        `https://graph.facebook.com/v21.0/${postId}/comments?${params.toString()}`,
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

  /**
   * Transform Instagram Graph API comment to PlatformComment format
   */
  private transformComment(comment: any): PlatformComment {
    return {
      id: comment.id,
      text: comment.text || '',
      authorName: comment.from?.username || 'Unknown',
      authorId: comment.from?.id,
      authorPicture: comment.from?.profile_picture_url,
      createdAt: comment.timestamp || comment.created_time,
      likeCount: comment.like_count,
      replyCount: comment.replies?.data?.length || 0,
      parentId: comment.parent?.id,
    };
  }

  /**
   * Get comments for an Instagram media
   */
  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    const platformPost = postDetails.platformPosts?.find((pp: any) => pp.socialAccountId === socialMediaAccount.id);
    const publishDetail = platformPost?.publishDetail ? JSON.parse(platformPost.publishDetail) : {};
    const externalPostId = publishDetail[socialMediaAccount.id]?.publishedId || publishDetail.postId;

    if (!externalPostId) {
      return Promise.resolve({ platform: this.pluginName, postId: '', comments: [], hasMore: false });
    }

    try {
      const params = new URLSearchParams({
        access_token: socialMediaAccount.accessToken,
        fields: 'id,text,created_at,timestamp,like_count,replies{id,text,created_at,from,like_count},from',
        limit: String(options?.limit || 50),
      });

      if (options?.cursor) {
        params.append('after', options.cursor);
      }

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${externalPostId}/comments?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Instagram get comments failed: ${error}`);
      }

      const data = await response.json();
      const comments: PlatformComment[] = (data.data || []).map((c: any) => this.transformComment(c));

      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments,
        hasMore: !!data.paging?.cursors?.after,
        nextCursor: data.paging?.cursors?.after,
      };
    } catch (error) {
      console.error('Error fetching Instagram comments:', error);
      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments: [],
        hasMore: false,
      };
    }
  }

  /**
   * Reply to a comment on Instagram
   */
  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    try {
      const params = new URLSearchParams({
        access_token: socialMediaAccount.accessToken,
        message: replyText,
      });

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${commentId}/replies?${params.toString()}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Instagram reply failed: ${error}`);
      }

      const data = await response.json();

      return {
        success: true,
        comment: this.transformComment(data),
      };
    } catch (error) {
      console.error('Error replying to Instagram comment:', error);
      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to comment',
      };
    }
  }
}
