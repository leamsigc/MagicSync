import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import type { PlatformStats } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent, type PluginPostDetails, type PluginSocialMediaAccount, type GetCommentsResponse, type ReplyCommentResponse, type PlatformComment } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import { google, youtube_v3 } from 'googleapis';
import type { YouTubeSettings } from '../../../shared/platformSettings';
import { platformConfigurations } from '../../../shared/platformConstants';

export class YouTubePlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'youtube';
  readonly pluginName = 'youtube';

  private getPlatformData(postDetails: PluginPostDetails) {
    const platformName = this.pluginName;
    const platformContent = (postDetails.platformContent as Record<string, { content: string; comments?: string[] } | undefined>)?.[platformName];
    const platformSettings = (postDetails.platformSettings as Record<string, unknown>)?.[platformName] as YouTubeSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings: platformSettings,
      postFormat: postDetails.postFormat || 'post'
    };
  }

  public override exposedMethods = [
    'getChannels',
    'getVideoCategories',
  ] as const;
  override maxConcurrentJob = platformConfigurations.youtube.maxConcurrentJob; // YouTube has strict upload quotas

  protected init(options?: Record<string, unknown>): void {
    console.log('YouTube plugin initialized', options);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];
    const postWithAssets = post as PostWithAllData;

    if (!postWithAssets.assets || postWithAssets.assets.length === 0) {
      errors.push('At least one video is required for YouTube uploads.');
    }

    const hasVideo = postWithAssets.assets?.some((asset: Asset) => asset.mimeType?.includes('video'));
    if (!hasVideo) {
      errors.push('YouTube requires a video file.');
    }

    return Promise.resolve(errors);
  }

  /**
   * Get user's YouTube channels
   */
  async getChannels(accessToken: string): Promise<youtube_v3.Schema$Channel[]> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth });
    const response = await youtube.channels.list({
      part: ['snippet', 'contentDetails', 'statistics'],
      mine: true,
    });

    return response.data.items || [];
  }

  /**
   * Get available video categories
   */
  async getVideoCategories(regionCode: string, accessToken: string): Promise<youtube_v3.Schema$VideoCategory[]> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth });
    const response = await youtube.videoCategories.list({
      part: ['snippet'],
      regionCode: regionCode || 'US',
    });

    return response.data.items || [];
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content, settings } = this.getPlatformData(postDetails);
      if (!postDetails.assets || postDetails.assets.length === 0) {
        throw new Error('Video file is required for YouTube uploads');
      }

      const videoAsset = postDetails.assets.find((asset: Asset) =>
        asset.mimeType.includes('video')
      );

      if (!videoAsset) {
        throw new Error('No video file found in assets');
      }

      // Setup OAuth2 client
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: socialMediaAccount.accessToken,
        refresh_token: socialMediaAccount.refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth });

      // Prepare video metadata
      const videoMetadata: youtube_v3.Schema$Video = {
        snippet: {
          title: postDetails.title || 'Untitled Video',
          description: content || '',
          tags: settings?.tags || [],
          categoryId: settings?.categoryId || '22', // Default: People & Blogs
        },
        status: {
          privacyStatus: settings?.privacyStatus || 'private', // public, unlisted, private
          selfDeclaredMadeForKids: settings?.madeForKids || false,
        },
      };

      // Download video
      const videoResponse = await fetch(getPublicUrlForAsset(videoAsset.url));
      const videoBuffer = await videoResponse.arrayBuffer();

      // Upload video
      const uploadResponse = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: videoMetadata,
        media: {
          mimeType: 'video/*',
          body: Buffer.from(videoBuffer),
        },
      });

      const videoId = uploadResponse.data.id;

      if (!videoId) {
        throw new Error('Failed to get video ID from YouTube');
      }

      // Set thumbnail if provided
      if (settings?.thumbnailUrl) {
        const thumbnailResponse = await fetch(settings.thumbnailUrl);
        const thumbnailBuffer = await thumbnailResponse.arrayBuffer();

        await youtube.thumbnails.set({
          videoId: videoId,
          media: {
            mimeType: 'image/jpeg',
            body: Buffer.from(thumbnailBuffer),
          },
        });
      }

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: videoId,
        releaseURL: `https://www.youtube.com/watch?v=${videoId}`,
        status: 'published',
      };

      this.emit('youtube:post:published', { postId: postResponse.postId, response: uploadResponse.data });
      return postResponse;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('youtube:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({
      access_token: socialMediaAccount.accessToken,
      refresh_token: socialMediaAccount.refreshToken,
    })

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

    // Fetch the authenticated user's channel (account-level stats)
    const channelsResponse = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true,
    })

    const channel = channelsResponse.data.items?.[0]
    if (!channel) {
      return {
        platform: 'youtube',
        accountId: socialMediaAccount.accountId,
        username: socialMediaAccount.accountName || '',
        fetchedAt: new Date().toISOString(),
        followers: 0,
        posts: 0,
        engagement: { total: 0 },
        growth: undefined,
      }
    }

    const snippet = channel.snippet || {}
    const contentDetails = channel.contentDetails || {}
    const stats = channel.statistics || {}
    const relatedPlaylists = contentDetails.relatedPlaylists || {}

    // Fetch recent uploads for engagement aggregation
    let totalEngagement = 0
    let recentVideoIds: string[] = []
    try {
      const uploadsPlaylistId = relatedPlaylists.uploads || ''
      if (uploadsPlaylistId) {
        const playlistItems = await youtube.playlistItems.list({
          part: ['contentDetails'],
          playlistId: uploadsPlaylistId,
          maxResults: 50,
        })
        for (const item of playlistItems.data.items || []) {
          const vid = item.contentDetails?.videoId
          if (vid) recentVideoIds.push(vid)
        }
      }
    } catch {
      // Playlist fetch failed — account stats still returned
    }

    // Batch-fetch video stats for engagement
    if (recentVideoIds.length > 0) {
      try {
        const chunkSize = 50
        for (let i = 0; i < recentVideoIds.length; i += chunkSize) {
          const chunk = recentVideoIds.slice(i, i + chunkSize)
          const videosResponse = await youtube.videos.list({
            part: ['statistics'],
            id: chunk,
          })
          for (const video of videosResponse.data.items || []) {
            const vs = video.statistics || {}
            totalEngagement += Number(vs.likeCount || 0) + Number(vs.commentCount || 0) + Number(vs.viewCount || 0)
          }
        }
      } catch {
        // Videos fetch failed
      }
    }

    return {
      platform: 'youtube',
      accountId: channel.id || socialMediaAccount.accountId,
      username: snippet.title || socialMediaAccount.accountName || '',
      picture: snippet.thumbnails?.default?.url || undefined,
      fetchedAt: new Date().toISOString(),
      followers: parseInt(stats.subscriberCount || '0', 10),
      posts: parseInt(stats.videoCount || '0', 10),
      engagement: {
        total: totalEngagement,
        views: 0,
      },
      growth: undefined,
      extra: {
        viewCount: parseInt(stats.viewCount || '0', 10),
        hiddenSubscriberCount: stats.hiddenSubscriberCount || false,
        uploadsPlaylistId: relatedPlaylists.uploads || undefined,
      },
    }
  }

  override async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content, settings } = this.getPlatformData(postDetails);
      const publicationDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: socialMediaAccount.accessToken,
        refresh_token: socialMediaAccount.refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      if (!publicationDetails) {
        throw new Error('Published platform details not found');
      }
      const details = JSON.parse(publicationDetails.publishDetail as unknown as string || '{}') as PostResponse;
      const postId = details.postId;

      if (!postId) {
        throw new Error('Video ID is required for update');
      }

      // ... update logic ...
      // Simplified for now or check existing logic
      const snippet: youtube_v3.Schema$VideoSnippet = {
        title: settings?.title || postDetails.title || 'Untitled Video',
        description: content,
        categoryId: '22',
      };

      await youtube.videos.update({
        part: ['snippet'],
        requestBody: {
          id: postId,
          snippet: snippet
        }
      });

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: postId,
        releaseURL: `https://www.youtube.com/watch?v=${postId}`,
        status: 'published',
      };

      this.emit('youtube:post:updated', { postId: postResponse.postId, postDetails });
      return postResponse;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('youtube:post:update:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async addComment(
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content } = this.getPlatformData(commentDetails);

      const publicationDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
      if (!publicationDetails) {
        throw new Error('Published platform details not found');
      }
      const details = JSON.parse(publicationDetails.publishDetail as unknown as string || '{}') as PostResponse;
      const postId = details.postId;

      if (!postId) {
        throw new Error('Video ID is required for commenting');
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: socialMediaAccount.accessToken,
        refresh_token: socialMediaAccount.refreshToken
      });

      const youtube = google.youtube({ version: 'v3', auth });

      const commentResponse = await youtube.commentThreads.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            videoId: postId,
            topLevelComment: {
              snippet: {
                textOriginal: content,
              },
            },
          },
        },
      });

      const commentId = commentResponse.data.id;

      const commentResult: PostResponse = {
        id: commentDetails.id,
        postId: commentId || '',
        releaseURL: `https://www.youtube.com/watch?v=${postId}&lc=${commentId}`,
        status: 'published',
      };

      this.emit('youtube:comment:added', { commentId: commentResult.postId, postDetails, commentDetails });
      return commentResult;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: commentDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('youtube:comment:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  /**
   * Transform YouTube commentThread to PlatformComment format
   */
  private transformComment(comment: Record<string, unknown>): PlatformComment {
    return {
      id: comment.id,
      text: comment.snippet?.topLevelComment?.snippet?.textOriginal || comment.snippet?.textOriginal || '',
      authorName: comment.snippet?.topLevelComment?.snippet?.authorDisplayName || comment.snippet?.authorDisplayName || 'Unknown',
      authorId: comment.snippet?.topLevelComment?.snippet?.authorChannelId?.value || comment.snippet?.authorChannelId?.value,
      authorPicture: comment.snippet?.topLevelComment?.snippet?.authorProfileImageUrl || comment.snippet?.authorProfileImageUrl,
      createdAt: comment.snippet?.topLevelComment?.snippet?.publishedAt || comment.snippet?.publishedAt || '',
      likeCount: comment.snippet?.topLevelComment?.snippet?.likeCount || comment.snippet?.likeCount,
      replyCount: comment.snippet?.totalReplyCount || 0,
      parentId: comment.snippet?.topLevelComment?.id === comment.id ? undefined : comment.snippet?.topLevelComment?.id,
    };
  }

  /**
   * Get comments for a YouTube video
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
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: socialMediaAccount.accessToken,
        refresh_token: socialMediaAccount.refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      const response = await youtube.commentThreads.list({
        part: ['snippet', 'replies'],
        videoId: externalPostId,
        maxResults: options?.limit || 50,
        pageToken: options?.cursor,
        order: 'time',
      });

      const comments: PlatformComment[] = (response.data.items || []).map((c) => this.transformComment(c as Record<string, unknown>));

      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments,
        hasMore: !!response.data.nextPageToken,
        nextCursor: response.data.nextPageToken,
      };
    } catch (error: unknown) {
      console.error('Error fetching YouTube comments:', error);
      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments: [],
        hasMore: false,
      };
    }
  }

  /**
   * Reply to a comment on YouTube
   */
  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: socialMediaAccount.accessToken,
        refresh_token: socialMediaAccount.refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      // Get the parent comment to find the video ID
      const parentComment = await youtube.comments.list({
        part: ['snippet'],
        id: commentId,
      });

      const videoId = parentComment.data.items?.[0]?.snippet?.videoId;
      if (!videoId) {
        throw new Error('Could not find video ID for comment');
      }

      const response = await youtube.commentThreads.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            videoId: videoId,
            topLevelComment: {
              snippet: {
                textOriginal: replyText,
                parentId: commentId, // Reply to the parent comment
              },
            },
          },
        },
      });

      const comment = response.data.snippet?.topLevelComment;

      return {
        success: true,
        comment: {
          id: response.data.id || '',
          text: comment?.snippet?.textOriginal || replyText,
          authorName: comment?.snippet?.authorDisplayName || 'Unknown',
          authorId: comment?.snippet?.authorChannelId?.value,
          authorPicture: comment?.snippet?.authorProfileImageUrl,
          createdAt: comment?.snippet?.publishedAt || new Date().toISOString(),
          parentId: commentId,
        },
      };
    } catch (error: unknown) {
      console.error('Error replying to YouTube comment:', error);
      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to comment',
      };
    }
  }
}
