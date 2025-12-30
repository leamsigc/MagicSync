import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent, type PluginPostDetails, type PluginSocialMediaAccount } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import { google, youtube_v3 } from 'googleapis';
import type { YouTubeSettings } from '../../../shared/platformSettings';
import { platformConfigurations } from '../../../shared/platformConstants';

export class YouTubePlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'youtube';
  readonly pluginName = 'youtube';

  private getPlatformData(postDetails: PluginPostDetails) {
    const platformName = this.pluginName;
    const platformContent = (postDetails as any).platformContent?.[platformName];
    const platformSettings = (postDetails as any).platformSettings?.[platformName] as YouTubeSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings: platformSettings,
      postFormat: (postDetails as any).postFormat || 'post'
    };
  }

  public override exposedMethods = [
    'getChannels',
    'getVideoCategories',
  ] as const;
  override maxConcurrentJob = platformConfigurations.youtube.maxConcurrentJob; // YouTube has strict upload quotas

  protected init(options?: any): void {
    console.log('YouTube plugin initialized', options);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];
    const postWithAssets = post as any;

    if (!postWithAssets.assets || postWithAssets.assets.length === 0) {
      errors.push('At least one video is required for YouTube uploads.');
    }

    const hasVideo = postWithAssets.assets?.some((asset: any) => asset.mimeType?.includes('video'));
    if (!hasVideo) {
      errors.push('YouTube requires a video file.');
    }

    return Promise.resolve(errors);
  }

  /**
   * Get user's YouTube channels
   */
  async getChannels(accessToken: string): Promise<any[]> {
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
  async getVideoCategories(regionCode: string, accessToken: string): Promise<any[]> {
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

      // Publish comments after the main post is ready
      if (comments && comments.length > 0) {
        await this.publishComments(postResponse, comments, socialMediaAccount);
      }

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
  ): Promise<any> {
    const publicationDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
    if (!publicationDetails) {
      throw new Error('Published platform details not found');
    }
    const details = JSON.parse(publicationDetails.publishDetail as unknown as string || '{}') as PostResponse;
    const postId = details.postId;

    if (!postId) {
      throw new Error('Post details not found');
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: socialMediaAccount.accessToken,
    });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const response = await youtube.videos.list({
      part: ['statistics'],
      id: [postId],
    });

    return response.data.items?.[0]?.statistics || {};
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
}
