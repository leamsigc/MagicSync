import { BaseSchedulerPlugin, type PluginPostDetails, type PluginSocialMediaAccount, type GetCommentsResponse, type ReplyCommentResponse, type PlatformComment, type PlatformStats, type PostResponse } from '../SchedulerPost.service';
import type { Post, PostWithAllData, Asset } from '#layers/BaseDB/db/schema';
import { google, youtube_v3 } from 'googleapis';
import type { YouTubeSettings } from '#layers/BaseScheduler/shared/platformSettings';
import { platformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';
import { getPublicUrlForAsset, fetchedImageBase64 } from '../../utils/ScheduleUtils';
import type { FacebookPage } from '#layers/BaseConnect/utils/FacebookPages';
import { Readable } from 'stream';

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
    'pages',
    'fetchPageInformation',
  ] as const;
  override maxConcurrentJob = platformConfigurations.youtube.maxConcurrentJob;

  protected init(options?: Record<string, unknown>): void {
    console.log('YouTube plugin initialized', options);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];
    const postWithAssets = post as PostWithAllData;
    const platformData = post.platformSettings as Record<string, YouTubeSettings> | undefined;
    const settings = platformData?.youtube;
    const postType = settings?.postType || 'video';

    if (postType === 'video' || postType === 'short') {
      if (!postWithAssets.assets || postWithAssets.assets.length === 0) {
        errors.push('At least one video is required for YouTube uploads.');
      }

      const hasVideo = postWithAssets.assets?.some((asset: Asset) => asset.mimeType?.includes('video'));
      if (!hasVideo) {
        errors.push('YouTube requires a video file.');
      }
    } else if (postType === 'post') {
      if (!postWithAssets.content && !postWithAssets.assets?.length) {
        errors.push('Community posts require text content or images.');
      }
    }

    return Promise.resolve(errors);
  }

  async getChannels(accessToken: string): Promise<youtube_v3.Schema$Channel[]> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const youtube = google.youtube({ version: 'v3', auth });
      const response = await youtube.channels.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        mine: true,
      });
      log.info(response);

      return response.data.items || [];
    } catch (error: unknown) {
      log.error({ content: 'Failed to fetch YouTube channels', plugin: 'youtube', error: (error as Error).message });
      this.logPluginEvent('get-channels', 'failure', `Error: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Get available video categories
   */
  async getVideoCategories(regionCode: string, accessToken: string): Promise<youtube_v3.Schema$VideoCategory[]> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const youtube = google.youtube({ version: 'v3', auth });
      const response = await youtube.videoCategories.list({
        part: ['snippet'],
        regionCode: regionCode || 'US',
      });

      return response.data.items || [];
    } catch (error: unknown) {
      log.error({ content: 'Failed to fetch YouTube categories', plugin: 'youtube', error: (error as Error).message });
      this.logPluginEvent('get-categories', 'failure', `Error: ${(error as Error).message}`);
      return [];
    }
  }



  async pages(_: unknown, accessToken: string): Promise<FacebookPage[]> {
    try {
      const channels = await this.getChannels(accessToken);
      log.info(channels)

      const pages = channels.map(channel => ({
        id: channel.id || '',
        name: channel.snippet?.title || '',
        picture: {
          data: {
            url: channel.snippet?.thumbnails?.default?.url || '',
          },
        },
      }));

      const imagePromises = pages.map(page =>
        page.picture.data.url ? fetchedImageBase64(page.picture.data.url) : Promise.resolve(undefined)
      );
      const imageBase64s = await Promise.all(imagePromises);

      return pages.map((page, index) => ({
        ...page,
        imageBase64: imageBase64s[index],
      })) as FacebookPage[];
    } catch (error: unknown) {
      log.error({ content: 'Failed to fetch YouTube channels for pages', plugin: 'youtube', error: (error as Error).message });
      this.logPluginEvent('get-pages', 'failure', `Error: ${(error as Error).message}`);
      return [];
    }
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content, settings } = this.getPlatformData(postDetails);
      const postType = settings?.postType || 'video';

      if (postType === 'post') {
        return await this.createCommunityPost(postDetails, socialMediaAccount);
      }

      if (!postDetails.assets || postDetails.assets.length === 0) {
        throw new Error('Video file is required for YouTube uploads');
      }

      const videoAsset = postDetails.assets.find((asset: Asset) =>
        asset.mimeType.includes('video')
      );

      if (!videoAsset) {
        throw new Error('No video file found in assets');
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: socialMediaAccount.accessToken,
        refresh_token: socialMediaAccount.refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth });

      const videoMetadata: youtube_v3.Schema$Video = {
        snippet: {
          title: settings?.title || postDetails.title || 'Untitled Video',
          description: content || '',
          tags: settings?.tags || [],
          categoryId: settings?.categoryId || '22',
        },
        status: {
          privacyStatus: settings?.privacyStatus || 'private',
          selfDeclaredMadeForKids: settings?.madeForKids || false,
        },
      };

      const videoResponse = await fetch(getPublicUrlForAsset(videoAsset.url));
      const videoBuffer = await videoResponse.arrayBuffer();

      const uploadResponse = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: videoMetadata,
        media: {
          mimeType: 'video/*',
          body: Readable.from(Buffer.from(videoBuffer)),
        },
      });

      const videoId = uploadResponse.data.id;

      if (!videoId) {
        throw new Error('Failed to get video ID from YouTube');
      }

      if (settings?.thumbnailUrl) {
        const thumbnailResponse = await fetch(settings.thumbnailUrl);
        const thumbnailBuffer = await thumbnailResponse.arrayBuffer();

        await youtube.thumbnails.set({
          videoId: videoId,
          media: {
            mimeType: 'image/jpeg',
            body: Readable.from(Buffer.from(thumbnailBuffer)),
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
      log.error({ content: 'YouTube post failed', plugin: 'youtube', error: (error as Error).message });
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
      this.emit('youtube:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  private async createCommunityPost(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content, settings } = this.getPlatformData(postDetails);

      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: socialMediaAccount.accessToken,
        refresh_token: socialMediaAccount.refreshToken,
      });

      const { token } = await auth.getAccessToken();
      const channelId = socialMediaAccount.accountId;

      const body: Record<string, unknown> = {
        snippet: {
          channelId,
          textOriginal: content || '',
        },
      };

      const imageAssets = postDetails.assets?.filter(a => a.mimeType?.startsWith('image/')) || [];
      if (imageAssets.length > 0) {
        (body.snippet as Record<string, unknown>).media = imageAssets.map(a => ({
          type: 'image',
          url: getPublicUrlForAsset(a.url),
        }));
      }

      const response = await fetch('https://www.googleapis.com/youtube/v3/posts?part=snippet', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`YouTube community post API error: ${response.status} ${errorBody}`);
      }

      const result = await response.json();

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: result.id || '',
        releaseURL: `https://www.youtube.com/channel/${channelId}/community`,
        status: 'published',
      };

      this.emit('youtube:post:published', { postId: postResponse.postId, response: result });
      return postResponse;
    } catch (error: unknown) {
      log.error({ content: 'YouTube community post failed', plugin: 'youtube', error: (error as Error).message });
      this.logPluginEvent('community-post-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id, {
        error: `${error}`,
      });

      return {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
    }
  }

  async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    try {
      const oauth2Client = new google.auth.OAuth2()
      oauth2Client.setCredentials({
        access_token: socialMediaAccount.accessToken,
        refresh_token: socialMediaAccount.refreshToken,
      })

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

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

      let totalEngagement = 0
      let totalViews = 0
      let totalLikes = 0
      let totalComments = 0
      let recentVideoIds: string[] = []
      let shortsCount = 0
      let shortsEngagement = 0
      let shortsViews = 0
      let regularVideosCount = 0
      let regularVideosEngagement = 0
      let regularVideosViews = 0
      let videoPerformances: Array<{ id: string; title: string; views: number; likes: number; comments: number; isShort: boolean }> = []

      try {
        const uploadsPlaylistId = relatedPlaylists.uploads || ''
        if (uploadsPlaylistId) {
          const playlistItems = await youtube.playlistItems.list({
            part: ['contentDetails', 'snippet'],
            playlistId: uploadsPlaylistId,
            maxResults: 50,
          })
          for (const item of playlistItems.data.items || []) {
            const vid = item.contentDetails?.videoId
            if (vid) recentVideoIds.push(vid)
          }
        }
      } catch {
      }

      if (recentVideoIds.length > 0) {
        try {
          const chunkSize = 50
          for (let i = 0; i < recentVideoIds.length; i += chunkSize) {
            const chunk = recentVideoIds.slice(i, i + chunkSize)
            const videosResponse = await youtube.videos.list({
              part: ['statistics', 'snippet', 'contentDetails'],
              id: chunk,
            })
            for (const video of videosResponse.data.items || []) {
              const vs = video.statistics || {}
              const views = Number(vs.viewCount || 0)
              const likes = Number(vs.likeCount || 0)
              const comments = Number(vs.commentCount || 0)
              const engagement = views + likes + comments

              totalEngagement += engagement
              totalViews += views
              totalLikes += likes
              totalComments += comments

              const durationStr = video.contentDetails?.duration || 'PT0S'
              const durationMatch = durationStr.match(/PT(\d+M)?(\d+S)?/)
              const minutes = parseInt(durationMatch?.[1]?.replace('M', '') || '0', 10)
              const seconds = parseInt(durationMatch?.[2]?.replace('S', '') || '0', 10)
              const totalSeconds = minutes * 60 + seconds
              const thumbnailUrl = video.snippet?.thumbnails?.maxres?.url || video.snippet?.thumbnails?.default?.url || ''
              const isShort = totalSeconds <= 60 && !thumbnailUrl.includes('shorts')

              if (isShort) {
                shortsCount++
                shortsEngagement += engagement
                shortsViews += views
              } else {
                regularVideosCount++
                regularVideosEngagement += engagement
                regularVideosViews += views
              }

              videoPerformances.push({
                id: video.id || '',
                title: video.snippet?.title || '',
                views,
                likes,
                comments,
                isShort,
              })
            }
          }
        } catch {
        }
      }

      const subscriberCount = parseInt(stats.subscriberCount || '0', 10)
      const engagementRate = subscriberCount > 0
        ? Math.round((totalLikes + totalComments) / subscriberCount * 10000) / 100
        : 0

      const base64Picture = snippet.thumbnails?.default?.url ? await fetchedImageBase64(snippet.thumbnails.default.url) : undefined;

      return {
        platform: 'youtube',
        accountId: channel.id || socialMediaAccount.accountId,
        username: snippet.title || socialMediaAccount.accountName || '',
        picture: base64Picture,
        fetchedAt: new Date().toISOString(),
        followers: subscriberCount,
        posts: parseInt(stats.videoCount || '0', 10),
        engagement: {
          total: totalEngagement,
          views: totalViews,
          likes: totalLikes,
          comments: totalComments,
        },
        growth: {
          followers: { absolute: 0, percentage: 0 },
          posts: { absolute: 0, percentage: 0 },
          engagement: { absolute: totalEngagement, percentage: engagementRate },
        },
        extra: {
          viewCount: parseInt(stats.viewCount || '0', 10),
          hiddenSubscriberCount: stats.hiddenSubscriberCount || false,
          uploadsPlaylistId: relatedPlaylists.uploads || undefined,
          shortsCount,
          shortsEngagement,
          shortsViews,
          regularVideosCount,
          regularVideosEngagement,
          regularVideosViews,
          engagementRate,
          videoPerformances,
          recentVideosAnalyzed: videoPerformances.length,
        },
      }
    } catch (error: unknown) {
      log.error({ content: 'YouTube stats fetch failed', plugin: 'youtube', error: (error as Error).message });
      this.logPluginEvent('get-stats', 'failure', `Error: ${(error as Error).message}`);

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

      const snippet: youtube_v3.Schema$VideoSnippet = {
        title: settings?.title || postDetails.title || 'Untitled Video',
        description: content,
        tags: settings?.tags || [],
        categoryId: settings?.categoryId || '22',
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
      log.error({ content: 'YouTube post update failed', plugin: 'youtube', error: (error as Error).message });
      this.logPluginEvent('update-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id, {
        error: `${error}`,
      });

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
      log.error({ content: 'YouTube comment failed', plugin: 'youtube', error: (error as Error).message });
      this.logPluginEvent('comment-error', 'failure', `Error: ${(error as Error).message}`, commentDetails.id, {
        error: `${error}`,
      });

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

  private transformComment(comment: any): PlatformComment {
    const snippet = comment?.snippet || {};
    const topLevelComment = snippet?.topLevelComment || {};
    const topSnippet = topLevelComment?.snippet || {};

    return {
      id: comment.id || '',
      text: topSnippet.textOriginal || snippet.textOriginal || '',
      authorName: topSnippet.authorDisplayName || snippet.authorDisplayName || 'Unknown',
      authorId: topSnippet.authorChannelId?.value || snippet.authorChannelId?.value,
      authorPicture: topSnippet.authorProfileImageUrl || snippet.authorProfileImageUrl,
      createdAt: topSnippet.publishedAt || snippet.publishedAt || '',
      likeCount: topSnippet.likeCount || snippet.likeCount || 0,
      replyCount: snippet.totalReplyCount || 0,
      parentId: topLevelComment.id === comment.id ? undefined : topLevelComment.id,
    };
  }

  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    const platformPost = postDetails.platformPosts?.find((pp) => pp.socialAccountId === socialMediaAccount.id);
    const publishDetail = platformPost?.publishDetail ? JSON.parse(platformPost.publishDetail) : {};
    const externalPostId = publishDetail[socialMediaAccount.id]?.publishedId || publishDetail.postId;

    if (!externalPostId) {
      return { platform: this.pluginName, postId: '', comments: [], hasMore: false };
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

      const comments: PlatformComment[] = (response.data.items || []).map((c) => this.transformComment(c));

      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments,
        hasMore: !!response.data.nextPageToken,
        nextCursor: response.data.nextPageToken || undefined,
      };
    } catch (error: unknown) {
      log.error({ content: 'Error fetching YouTube comments', plugin: 'youtube', error: (error as Error).message });
      this.logPluginEvent('get-comments', 'failure', `Error: ${(error as Error).message}`);
      return {
        platform: this.pluginName,
        postId: externalPostId || '',
        comments: [],
        hasMore: false,
      };
    }
  }

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

      const parentComment = await youtube.comments.list({
        part: ['snippet'],
        id: [commentId],
      });

      const videoId = parentComment.data?.items?.[0]?.snippet?.videoId;
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
          authorId: comment?.snippet?.authorChannelId?.value || undefined,
          authorPicture: comment?.snippet?.authorProfileImageUrl || undefined,
          createdAt: comment?.snippet?.publishedAt || new Date().toISOString(),
          parentId: commentId,
        },
      };
    } catch (error: unknown) {
      log.error({ content: 'Error replying to YouTube comment', plugin: 'youtube', error: (error as Error).message });
      this.logPluginEvent('reply-comment-error', 'failure', `Error: ${(error as Error).message}`, commentId);

      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to comment',
      };
    }
  }

  async fetchPageInformation(_: YouTubePlugin, pageId: string, accessToken: string): Promise<{
    id: string;
    name: string;
    access_token: string;
    picture: string;
    username: string;
  }> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const youtube = google.youtube({ version: 'v3', auth });
      const response = await youtube.channels.list({
        part: ['snippet'],
        id: [pageId],
      });
      const channel = response.data.items?.[0];
      if (!channel) {
        throw new Error('Channel not found');
      }
      return {
        id: channel.id || pageId,
        name: channel.snippet?.title || '',
        access_token: accessToken,
        picture: channel.snippet?.thumbnails?.default?.url || '',
        username: channel.snippet?.customUrl || '',
      };
    } catch (error: unknown) {
      log.error({ content: 'Failed to fetch YouTube channel info', plugin: 'youtube', error: (error as Error).message });
      this.logPluginEvent('fetch-page-information', 'failure', `Error: ${(error as Error).message}`);
      return { id: pageId, name: '', access_token: accessToken, picture: '', username: '' };
    }
  }
}
