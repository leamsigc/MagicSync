import type { PluginPostDetails, PostResponse, Integration, PluginSocialMediaAccount, GetCommentsResponse, ReplyCommentResponse, PlatformComment } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent, type PlatformStats } from '../SchedulerPost.service';
import type { Post, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import type { TikTokSettings } from '../../../shared/platformSettings';

import { platformConfigurations } from '../../../shared/platformConstants';

export class TikTokPlugin extends BaseSchedulerPlugin {
  override async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    try {
      const accessToken = socialMediaAccount.accessToken;
      if (!accessToken) {
        return this.fallbackStats(socialMediaAccount);
      }

      const response = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,username,followers_count,following_count,likes_count,video_count',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        log.error({ content: 'TikTok getStatistic failed', status: response.status, body: await response.text() });
        return this.fallbackStats(socialMediaAccount);
      }

      const data = await response.json();
      const user = data.data || {};

      let totalEngagement = 0
      let totalViews = 0
      let totalComments = 0
      let totalShares = 0
      let videoInsights: Array<{ id: string; views: number; likes: number; comments: number; shares: number; engagement: number }> = []

      try {
        const videoQueryResponse = await fetch(
          'https://open.tiktokapis.com/v2/video/query/?fields=id,views,likes_count,comments_count,shares_count,create_time',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              max_count: 20,
            }),
          }
        )

        if (videoQueryResponse.ok) {
          const videoData = await videoQueryResponse.json()
          const videos = videoData.data?.videos || []
          for (const video of videos) {
            const views = video.views || 0
            const likes = video.likes_count || 0
            const comments = video.comments_count || 0
            const shares = video.shares_count || 0
            const engagement = likes + comments + shares

            totalEngagement += engagement
            totalViews += views
            totalComments += comments
            totalShares += shares

            videoInsights.push({
              id: video.id,
              views,
              likes,
              comments,
              shares,
              engagement,
            })
          }
        }
      } catch (error: unknown) {
        log.error({ content: 'TikTok videos fetch failed', plugin: 'tiktok', error: (error as Error).message });
      }

      const engagementRate = user.followers_count > 0
        ? Math.round((user.likes_count / user.followers_count) * 10000) / 100
        : 0

      const base64Picture = user.avatar_url ? await fetchedImageBase64(user.avatar_url) : undefined;

      return {
        platform: 'tiktok',
        accountId: user.open_id || socialMediaAccount.id,
        username: user.username || socialMediaAccount.accountName || '',
        picture: base64Picture,
        fetchedAt: new Date().toISOString(),
        followers: user.followers_count || 0,
        following: user.following_count || 0,
        posts: user.video_count || 0,
        engagement: {
          total: user.likes_count || 0,
          likes: user.likes_count || 0,
          comments: totalComments,
          shares: totalShares,
          views: totalViews,
        },
        growth: {
          followers: { absolute: 0, percentage: 0 },
          posts: { absolute: 0, percentage: 0 },
          engagement: { absolute: totalEngagement, percentage: engagementRate },
        },
        extra: {
          displayName: user.display_name,
          engagementRate,
          totalVideoEngagement: totalEngagement,
          totalVideoViews: totalViews,
          videoInsights,
          recentVideosCount: videoInsights.length,
        },
      };
    } catch (error: unknown) {
      log.error({ content: 'TikTok getStatistic error', plugin: 'tiktok', error: (error as Error).message });
      this.logPluginEvent('get-stats', 'failure', `Error: ${(error as Error).message}`);
      return this.fallbackStats(socialMediaAccount);
    }
  }

  private fallbackStats(socialMediaAccount: PluginSocialMediaAccount): PlatformStats {
    return {
      platform: 'tiktok',
      accountId: socialMediaAccount.id,
      username: socialMediaAccount.accountName || '',
      picture: undefined,
      fetchedAt: new Date().toISOString(),
      followers: 0,
      following: 0,
      posts: 0,
      engagement: {
        total: 0,
        likes: 0,
      },
    };
  }
  static readonly pluginName = 'tiktok';
  readonly pluginName = 'tiktok';

  private normalizeContent(content: string): string {
    if (!content) return '';
    return content
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }

  private getPlatformData(postDetails: PluginPostDetails, platformPost?: { platformSettings?: Record<string, unknown> }) {
    const platformName = this.pluginName;
    const platformPostSettings = platformPost?.platformSettings || {};
    const platformContent = platformPostSettings?.platformContent ||
      (postDetails.platformContent as Record<string, { content: string; comments?: string[] } | undefined>)?.[platformName];
    const platformSettings = platformPostSettings ||
      (postDetails.platformSettings as Record<string, unknown>)?.[platformName] as TikTokSettings | undefined;

    const rawContent = platformContent?.content || postDetails.content;

    return {
      content: this.normalizeContent(rawContent),
      settings: platformSettings,
      postFormat: postDetails.postFormat || 'post'
    };
  }

  public override exposedMethods = [
    'tiktokMaxLength',
    'getUser',
    'getVideoInfo',
  ] as const;
  override maxConcurrentJob = platformConfigurations.tiktok.maxConcurrentJob;

  tiktokMaxLength() {
    return platformConfigurations.tiktok.maxPostLength;
  }
  protected init(options?: Record<string, unknown>): void {
    console.log('TikTok plugin initialized', options);
  }

  override async validate(post: PluginPostDetails): Promise<string[]> {
    const errors: string[] = [];

    if (post.content && post.content.length > platformConfigurations.tiktok.maxPostLength) {
      errors.push(`Caption is too long (max ${platformConfigurations.tiktok.maxPostLength} characters)`);
    }
    if (!post.assets || post.assets.length === 0) {
      errors.push('At least one video is required for TikTok posts.');
    }

    const hasVideo = post.assets?.some((asset: Asset) => asset.mimeType?.includes('video'));
    if (!hasVideo) {
      errors.push('TikTok requires a video file (MP4 + H.264).');
    }

    return Promise.resolve(errors);
  }

  /**
   * Get authenticated user information
   */
  async getUser(accessToken: string): Promise<Record<string, unknown>> {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.json();
  }

  /**
   * Get video information
   */
  async getVideoInfo(videoId: string, accessToken: string): Promise<Record<string, unknown>> {
    const response = await fetch(
      `https://open.tiktokapis.com/v2/video/query/?fields=id,create_time,cover_image_url,duration,height,width,title,video_description`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: {
            video_ids: [videoId],
          },
        }),
      }
    );
    return response.json();
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      if (!postDetails.assets || postDetails.assets.length === 0) {
        throw new Error('Video file is required for TikTok posts');
      }

      const videoAsset = postDetails.assets.find((asset: Asset) =>
        asset.mimeType.includes('video')
      );

      if (!videoAsset) {
        throw new Error('No video file found in assets');
      }

      const { content, settings } = this.getPlatformData(postDetails);

      // Step 1: Initialize video upload
      const initData = {
        post_info: {
          title: content || '', // Use platform content as title
          privacy_level: settings?.privacy_level || 'PUBLIC', // Default to PUBLIC if not set
          disable_duet: settings?.disable_duet ?? false,
          disable_comment: settings?.disable_comment ?? false,
          disable_stitch: settings?.disable_stitch ?? false,
          video_cover_timestamp_ms: settings?.video_cover_timestamp_ms || 0,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoAsset.size || 0,
          chunk_size: 10485760, // 10MB chunks
          total_chunk_count: Math.ceil((videoAsset.size || 0) / 10485760),
        },
      };

      const initResponse = await fetch(
        'https://open.tiktokapis.com/v2/post/publish/video/init/',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${socialMediaAccount.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(initData),
        }
      );

      if (!initResponse.ok) {
        const error = await initResponse.text();
        throw new Error(`TikTok init failed: ${error}`);
      }

      const initResult = await initResponse.json();
      const publishId = initResult.data.publish_id;
      const uploadUrl = initResult.data.upload_url;

      // Step 2: Upload video file
      const videoResponse = await fetch(getPublicUrlForAsset(videoAsset.url));
      const videoBlob = await videoResponse.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(videoBlob.size),
        },
        body: videoBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Video upload to TikTok failed');
      }

      // Step 3: Check upload status and finalize
      let uploadComplete = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!uploadComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        const statusResponse = await fetch(
          `https://open.tiktokapis.com/v2/post/publish/status/${publishId}/`,
          {
            headers: {
              Authorization: `Bearer ${socialMediaAccount.accessToken}`,
            },
          }
        );

        const statusData = await statusResponse.json();

        if (statusData.data.status === 'PUBLISH_COMPLETE') {
          uploadComplete = true;
        } else if (statusData.data.status === 'FAILED') {
          throw new Error(`TikTok upload failed: ${statusData.data.fail_reason}`);
        }

        attempts++;
      }

      if (!uploadComplete) {
        throw new Error('TikTok upload timeout');
      }

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: publishId,
        releaseURL: `https://www.tiktok.com/@${socialMediaAccount.accountName}/video/${publishId}`,
        status: 'published',
      };

      this.emit('tiktok:post:published', { postId: postResponse.postId });
      return postResponse;
    } catch (error: unknown) {
      log.error({ content: 'TikTok post failed', plugin: 'tiktok', error: (error as Error).message });
      this.logPluginEvent('post-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id);
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('tiktok:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    // TikTok does not support editing videos
    const errorResponse: PostResponse = {
      id: postDetails.id,
      postId: postDetails.postId || '',
      releaseURL: '',
      status: 'failed',
      error: 'TikTok does not support editing videos via API.',
    };
    this.emit('tiktok:post:update:failed', {
      error: 'TikTok API does not support video editing'
    });
    return Promise.resolve(errorResponse);
  }

  override async addComment(
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      if (!postDetails.postId) {
        throw new Error('Video ID is required for commenting');
      }

      const response = await fetch(
        'https://open.tiktokapis.com/v2/comment/publish/',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${socialMediaAccount.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            video_id: postDetails.postId,
            text: commentDetails.content,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`TikTok comment failed: ${error}`);
      }

      const data = await response.json();

      const commentResponse: PostResponse = {
        id: commentDetails.id,
        postId: data.data.comment_id,
        releaseURL: postDetails.releaseURL || '',
        status: 'published',
      };

      this.emit('tiktok:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
      return commentResponse;
    } catch (error: unknown) {
      log.error({ content: 'TikTok comment failed', plugin: 'tiktok', error: (error as Error).message });
      this.logPluginEvent('comment-error', 'failure', `Error: ${(error as Error).message}`, commentDetails.id);
      const errorResponse: PostResponse = {
        id: commentDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('tiktok:comment:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  /**
   * Transform TikTok comment to PlatformComment format
   */
  private transformComment(comment: Record<string, unknown>): PlatformComment {
    return {
      id: comment.comment_id,
      text: comment.text || '',
      authorName: comment.user?.nickname || comment.commenter_info?.nickname || 'Unknown',
      authorId: comment.user?.open_id || comment.commenter_info?.open_id,
      authorPicture: comment.user?.avatar_url || comment.commenter_info?.avatar_url,
      createdAt: comment.create_time ? new Date(comment.create_time * 1000).toISOString() : '',
      likeCount: comment.like_count,
      replyCount: comment.reply_comment_total || 0,
      parentId: comment.parent_id,
    };
  }

  /**
   * Get comments for a TikTok video
   */
  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    const platformPost = postDetails.platformPosts?.find((pp) => pp.socialAccountId === socialMediaAccount.id);
    const publishDetail = platformPost?.publishDetail ? JSON.parse(platformPost.publishDetail) : {};
    const externalPostId = publishDetail[socialMediaAccount.id]?.publishedId || publishDetail.postId;

    if (!externalPostId) {
      return Promise.resolve({ platform: this.pluginName, postId: '', comments: [], hasMore: false });
    }

    try {
      const response = await fetch(
        `https://open.tiktokapis.com/v2/comment/list/?fields=id,text,create_time,like_count,reply_count,parent_id,user{display_name,avatar_url,open_id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${socialMediaAccount.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            video_id: externalPostId,
            max_count: options?.limit || 50,
            cursor: options?.cursor || 0,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`TikTok get comments failed: ${error}`);
      }

      const data = await response.json();
      const comments: PlatformComment[] = (data.comments || []).map((c: Record<string, unknown>) => this.transformComment(c));

      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments,
        hasMore: data.has_more || false,
        nextCursor: data.cursor ? String(data.cursor) : undefined,
      };
    } catch (error: unknown) {
      log.error({ content: 'Error fetching TikTok comments', plugin: 'tiktok', error: (error as Error).message });
      this.logPluginEvent('get-comments', 'failure', `Error: ${(error as Error).message}`);
      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments: [],
        hasMore: false,
      };
    }
  }

  /**
   * Reply to a comment on TikTok
   */
  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    try {
      const platformPost = postDetails.platformPosts?.find((pp) => pp.socialAccountId === socialMediaAccount.id);
      const publishDetail = platformPost?.publishDetail ? JSON.parse(platformPost.publishDetail) : {};
      const videoId = publishDetail[socialMediaAccount.id]?.publishedId || publishDetail.postId;

      const response = await fetch(
        'https://open.tiktokapis.com/v2/comment/publish/',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${socialMediaAccount.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            video_id: videoId,
            parent_comment_id: commentId, // Reply to the parent comment
            text: replyText,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`TikTok reply failed: ${error}`);
      }

      const data = await response.json();

      return {
        success: true,
        comment: this.transformComment(data.data || { comment_id: data.comment_id, text: replyText }),
      };
    } catch (error: unknown) {
      log.error({ content: 'Error replying to TikTok comment', plugin: 'tiktok', error: (error as Error).message });
      this.logPluginEvent('reply-comment-error', 'failure', `Error: ${(error as Error).message}`, commentId);
      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to comment',
      };
    }
  }
}
