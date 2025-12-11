import type { Asset, PostWithAllData, SocialMediaAccount } from '#layers/BaseDB/db/schema';
import type { PostResponse, } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { FacebookSettings } from '#layers/BaseScheduler/shared/platformSettings';
import dayjs from 'dayjs';
import { BaseSchedulerPlugin } from '#layers/BaseScheduler/server/services/SchedulerPost.service';

// Placeholder types - these should ideally be imported from a shared types file
type AuthTokenDetails = {
  refreshToken: string;
  expiresIn: number;
  accessToken: string;
  id: string;
  name: string;
  picture: string;
  username: string;
};

type AnalyticsData = {
  label: string;
  percentageChange: number;
  data: { total: number; date: string }[];
};

// Placeholder for FacebookDto - define its structure if known
type FacebookDto = {
  url?: string;
};

export class FacebookPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'facebook';
  readonly pluginName = 'facebook';

  private getPlatformData(postDetails: PostWithAllData) {
    const platformName = this.pluginName;
    const platformContent = (postDetails as any).platformContent?.[platformName];
    const platformSettings = (postDetails as any).platformSettings?.[platformName] as FacebookSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings: platformSettings,
      postFormat: (postDetails as any).postFormat || 'post'
    };
  }

  public override exposedMethods = [
    'handleErrors',
    'reConnect',
    'pages',
    'fetchPageInformation',
    'analytics',
    'getPageInsights',
    'getPostInsights',
    'getComments',
    'getCommentCount',
    'replyToComment',
    'deleteComment',
    'hideComment',
    'getTaggedPosts',
    'getMentions',
    'getConversations',
    'replyToConversation',
  ] as const;


  private readonly API_VERSION = 'v20.0';
  private readonly GRAPH_API_BASE_URL = 'https://graph.facebook.com';
  private readonly OAUTH_DIALOG_URL = 'https://www.facebook.com/v20.0/dialog/oauth';
  private readonly baseUrl = useRuntimeConfig().APP_URL || 'http://localhost:3000'

  protected init(options?: any): void {
    // Initialize Facebook API client or settings
    console.log('Facebook plugin initialized', options);
  }


  /**
   * Constructs a Facebook Graph API URL.
   * @param path The API endpoint path (e.g., '/me', '/{page-id}/videos').
   * @returns The full Graph API URL.
   */
  private _getGraphApiUrl(path: string): string {
    return `${this.GRAPH_API_BASE_URL}/${this.API_VERSION}${path}`;
  }

  /**
   * Generic fetch wrapper for Facebook API calls with error handling.
   * @param url The URL to fetch.
   * @param options Request options.
   * @param context A descriptive string for logging/error reporting.
   * @returns The fetch Response.
   */
  protected async fetch(
    url: string,
    options?: RequestInit,
    context?: string
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Facebook API Error (${context}): ${response.status} - ${errorBody}`);
        throw new Error(`Facebook API Error (${context}): ${errorBody}`);
      }
      return response;
    } catch (error) {
      console.error(`Network or Fetch Error (${context}):`, error);
      throw error;
    }
  }

  handleErrors(body: string):
    | {
      type: 'refresh-token' | 'bad-body';
      value: string;
    }
    | undefined {
    // Access token validation errors - require re-authentication
    if (body.indexOf('Error validating access token') > -1) {
      return {
        type: 'refresh-token' as const,
        value: 'Please re-authenticate your Facebook account',
      };
    }

    if (body.indexOf('490') > -1) {
      return {
        type: 'refresh-token' as const,
        value: 'Access token expired, please re-authenticate',
      };
    }

    if (body.indexOf('REVOKED_ACCESS_TOKEN') > -1) {
      return {
        type: 'refresh-token' as const,
        value: 'Access token has been revoked, please re-authenticate',
      };
    }

    if (body.indexOf('1366046') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Photos should be smaller than 4 MB and saved as JPG, PNG',
      };
    }

    if (body.indexOf('1390008') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'You are posting too fast, please slow down',
      };
    }

    // Content policy violations
    if (body.indexOf('1346003') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Content flagged as abusive by Facebook',
      };
    }

    if (body.indexOf('1404006') > -1) {
      return {
        type: 'bad-body' as const,
        value:
          "We couldn't post your comment, A security check in facebook required to proceed.",
      };
    }

    if (body.indexOf('1404102') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Content violates Facebook Community Standards',
      };
    }

    // Permission errors
    if (body.indexOf('1404078') > -1) {
      return {
        type: 'refresh-token' as const,
        value: 'Page publishing authorization required, please re-authenticate',
      };
    }

    if (body.indexOf('1609008') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Cannot post Facebook.com links',
      };
    }

    // Parameter validation errors
    if (body.indexOf('2061006') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Invalid URL format in post content',
      };
    }

    if (body.indexOf('1349125') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Invalid content format',
      };
    }

    if (body.indexOf('Name parameter too long') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Post content is too long',
      };
    }

    // Service errors - checking specific subcodes first
    if (body.indexOf('1363047') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Facebook service temporarily unavailable',
      };
    }

    if (body.indexOf('1609010') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Facebook service temporarily unavailable',
      };
    }

    return undefined;
  }

  /**
   * Get page-level insights/statistics
   */
  async getPageInsights(
    pageId: string,
    accessToken: string,
    days: number = 30
  ): Promise<any> {
    const until = dayjs().endOf('day').unix();
    const since = dayjs().subtract(days, 'day').unix();

    const url = this._getGraphApiUrl(
      `/${pageId}/insights?metric=page_impressions,page_impressions_unique,page_engaged_users,page_post_engagements,page_fans,page_views_total&access_token=${accessToken}&period=day&since=${since}&until=${until}`
    );
    const { data } = await (
      await this.fetch(url, undefined, 'fetch page insights')
    ).json();

    return data?.map((d: any) => ({
      label:
        d.name === 'page_impressions' ? 'Page Impressions' :
          d.name === 'page_impressions_unique' ? 'Unique Impressions' :
            d.name === 'page_engaged_users' ? 'Engaged Users' :
              d.name === 'page_post_engagements' ? 'Post Engagements' :
                d.name === 'page_fans' ? 'Page Fans' :
                  'Page Views',
      data: d?.values?.map((v: any) => ({
        total: v.value,
        date: dayjs(v.end_time).format('YYYY-MM-DD'),
      })),
    })) || [];
  }

  /**
   * Get post-level insights/statistics
   */
  async getPostInsights(
    postId: string,
    accessToken: string
  ): Promise<any> {
    const url = this._getGraphApiUrl(
      `/${postId}/insights?metric=post_impressions,post_impressions_unique,post_engaged_users,post_clicks,post_reactions_by_type_total&access_token=${accessToken}`
    );
    const { data } = await (
      await this.fetch(url, undefined, 'fetch post insights')
    ).json();

    return data?.map((d: any) => ({
      label:
        d.name === 'post_impressions' ? 'Post Impressions' :
          d.name === 'post_impressions_unique' ? 'Unique Impressions' :
            d.name === 'post_engaged_users' ? 'Engaged Users' :
              d.name === 'post_clicks' ? 'Post Clicks' :
                'Reactions',
      value: d.values?.[0]?.value || 0,
    })) || [];
  }

  /**
   * Get comments on a post or page object
   */
  async getComments(
    objectId: string,
    accessToken: string,
    options?: { limit?: number; after?: string }
  ): Promise<any> {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,message,from,created_time,like_count,comment_count,parent',
      limit: String(options?.limit || 25),
      ...(options?.after ? { after: options.after } : {}),
    });

    const url = this._getGraphApiUrl(`/${objectId}/comments?${params.toString()}`);
    const response = await this.fetch(url, undefined, 'get comments');
    return response.json();
  }

  /**
   * Get comment count for a post
   */
  async getCommentCount(
    postId: string,
    accessToken: string
  ): Promise<number> {
    const url = this._getGraphApiUrl(
      `/${postId}?fields=comments.summary(true).limit(0)&access_token=${accessToken}`
    );
    const data = await (
      await this.fetch(url, undefined, 'get comment count')
    ).json();

    return data?.comments?.summary?.total_count || 0;
  }

  /**
   * Reply to a comment
   */
  async replyToComment(
    commentId: string,
    replyText: string,
    accessToken: string
  ): Promise<any> {
    const url = this._getGraphApiUrl(`/${commentId}/comments?access_token=${accessToken}`);
    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: replyText,
        }),
      },
      'reply to comment'
    );
    return response.json();
  }

  /**
   * Delete a comment
   */
  async deleteComment(
    commentId: string,
    accessToken: string
  ): Promise<{ success: boolean }> {
    const url = this._getGraphApiUrl(`/${commentId}?access_token=${accessToken}`);
    const response = await this.fetch(
      url,
      {
        method: 'DELETE',
      },
      'delete comment'
    );
    return response.json();
  }

  /**
   * Hide or unhide a comment
   */
  async hideComment(
    commentId: string,
    isHidden: boolean,
    accessToken: string
  ): Promise<{ success: boolean }> {
    const url = this._getGraphApiUrl(`/${commentId}?access_token=${accessToken}`);
    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_hidden: isHidden,
        }),
      },
      'hide comment'
    );
    return response.json();
  }

  /**
   * Get posts where the page is tagged
   */
  async getTaggedPosts(
    pageId: string,
    accessToken: string,
    options?: { limit?: number; after?: string }
  ): Promise<any> {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,message,created_time,from,permalink_url',
      limit: String(options?.limit || 25),
      ...(options?.after ? { after: options.after } : {}),
    });

    const url = this._getGraphApiUrl(`/${pageId}/tagged?${params.toString()}`);
    const response = await this.fetch(url, undefined, 'get tagged posts');
    return response.json();
  }

  /**
   * Get mentions of the page (same as tagged for now)
   */
  async getMentions(
    pageId: string,
    accessToken: string,
    options?: { limit?: number; after?: string }
  ): Promise<any> {
    return this.getTaggedPosts(pageId, accessToken, options);
  }

  /**
   * Get page conversations/messages
   */
  async getConversations(
    pageId: string,
    accessToken: string,
    options?: { limit?: number; after?: string }
  ): Promise<any> {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,link,updated_time,message_count,unread_count,participants',
      limit: String(options?.limit || 25),
      ...(options?.after ? { after: options.after } : {}),
    });

    const url = this._getGraphApiUrl(`/${pageId}/conversations?${params.toString()}`);
    const response = await this.fetch(url, undefined, 'get conversations');
    return response.json();
  }

  /**
   * Reply to a conversation
   */
  async replyToConversation(
    conversationId: string,
    message: string,
    accessToken: string
  ): Promise<any> {
    const url = this._getGraphApiUrl(`/${conversationId}/messages?access_token=${accessToken}`);
    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
        }),
      },
      'reply to conversation'
    );
    return response.json();
  }

  async reConnect(
    id: string,
    requiredId: string,
    accessToken: string
  ): Promise<AuthTokenDetails> {
    const information = await this.fetchPageInformation(
      this,
      requiredId,
      accessToken
    );

    return {
      id: information.id,
      name: information.name,
      accessToken: information.access_token,
      refreshToken: information.access_token,
      expiresIn: dayjs().add(59, 'days').unix() - dayjs().unix(),
      picture: information.picture,
      username: information.username,
    };
  }

  async pages(_: any, accessToken: string) {
    const url = this._getGraphApiUrl(`/me/accounts?fields=id,username,name,picture.type(large)&access_token=${accessToken}`);
    const { data } = await (
      await this.fetch(url, undefined, 'fetch pages')
    ).json();

    return data;
  }

  async fetchPageInformation(_: FacebookPlugin, pageId: string, accessToken: string,): Promise<{
    id: string;
    name: string;
    access_token: string;
    picture: string;
    username: string;
  }> {
    console.log(pageId, accessToken);

    const url = this._getGraphApiUrl(`/${pageId}?fields=username,access_token,name,picture.type(large)&access_token=${accessToken}`);
    const {
      id,
      name,
      access_token,
      username,
      picture: {
        data: { url: pictureUrl },
      },
    } = await (
      await this.fetch(url, undefined, 'fetch page information')
    ).json();

    return {
      id,
      name,
      access_token,
      picture: pictureUrl,
      username,
    };
  }

  async analytics(
    id: string,
    accessToken: string,
    date: number
  ): Promise<AnalyticsData[]> {
    const until = dayjs().endOf('day').unix();
    const since = dayjs().subtract(date, 'day').unix();

    const url = this._getGraphApiUrl(
      `/${id}/insights?metric=page_impressions_unique,page_posts_impressions_unique,page_post_engagements,page_daily_follows,page_video_views&access_token=${accessToken}&period=day&since=${since}&until=${until}`
    );
    const { data } = await (
      await this.fetch(url, undefined, 'fetch analytics')
    ).json();

    return (
      data?.map((d: any) => ({
        label:
          d.name === 'page_impressions_unique'
            ? 'Page Impressions'
            : d.name === 'page_post_engagements'
              ? 'Posts Engagement'
              : d.name === 'page_daily_follows'
                ? 'Page followers'
                : d.name === 'page_video_views'
                  ? 'Videos views'
                  : 'Posts Impressions',
        percentageChange: 5, // This seems to be a static value in the example, consider if it should be dynamic
        data: d?.values?.map((v: any) => ({
          total: v.value,
          date: dayjs(v.end_time).format('YYYY-MM-DD'),
        })),
      })) || []
    );
  }


  override async validate(post: PostWithAllData): Promise<string[]> {

    const errors: string[] = [];
    const detail = post;
    if (detail.content && detail.content.length > 63206) {
      errors.push('Post content is too long');
    }
    if (detail.assets) {
      for (const media of detail.assets) {
        if (media.mimeType !== 'image' && media.mimeType !== 'video') {
          errors.push(`Unsupported media type: ${media.mimeType}, only image and video allowed`);
        }
      }
    }
    // Check for Facebook.com links
    if (detail.content && detail.content.includes('facebook.com')) {
      errors.push('Cannot post Facebook.com links');
    }
    // Check URL format if settings.url
    if ((detail as any).settings?.url) {
      try {
        new URL((detail as any).settings.url);
      } catch {
        errors.push('Invalid URL format in post content');
      }
    }
    return errors;
  }

  /**
   * Uploads a video to Facebook.
   * @param accountId The Facebook page/user ID.
   * @param accessToken The access token for the account.
   * @param postDetails The post details containing the video.
   * @returns The video ID.
   */
  private async _uploadVideo(
    accountId: string,
    accessToken: string,
    postDetails: PostWithAllData,
    description?: string
  ): Promise<{ id: string; permalink_url: string }> {
    const theFirstVideoFromThePost = postDetails.assets?.find((media) => media.mimeType.includes('video') || media.filename.includes('.mp4'));

    const url = this._getGraphApiUrl(`/${accountId}/videos?access_token=${accessToken}&fields=id,permalink_url`);
    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: `${this.baseUrl}${theFirstVideoFromThePost?.url.replace('/serve/', '/public/')}?userId=${postDetails.userId}`,
          description: description || postDetails.content,
          published: true,
        }),
      },
      'upload mp4'
    );
    return response.json();
  }

  /**
   * Uploads multiple photos to Facebook.
   * @param accountId The Facebook page/user ID.
   * @param accessToken The access token for the account.
   * @param media An array of media content (photos).
   * @returns An array of uploaded photo IDs (media_fbid).
   */
  private async _uploadPhotos(
    accountId: string,
    accessToken: string,
    media: Asset[],
    userId: string
  ): Promise<{ media_fbid: string }[]> {
    return Promise.all(
      media.map(async (m) => {
        const url = this._getGraphApiUrl(`/${accountId}/photos?access_token=${accessToken}`);
        const response = await this.fetch(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: `${this.baseUrl}${m.url.replace('/serve/', '/public/')}?userId=${userId}`,
              published: false,
            }),
          },
          'upload images slides'
        );
        const { id: photoId } = await response.json();
        return { media_fbid: photoId };
      })
    );
  }

  /**
   * Creates a feed post on Facebook.
   * @param accountId The Facebook page/user ID.
   * @param accessToken The access token for the account.
   * @param message The post message.
   * @param mediaFbids An array of media FBIDs for attached photos.
   * @param link Optional link to include in the post.
   * @returns The post ID and permalink URL.
   */
  private async _createFeedPost(
    accountId: string,
    accessToken: string,
    message: string,
    mediaFbids: { media_fbid: string }[],
    link?: string
  ): Promise<{ id: string; permalink_url: string }> {
    const url = this._getGraphApiUrl(`/${accountId}/feed?access_token=${accessToken}&fields=id,permalink_url`);
    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(mediaFbids?.length ? { attached_media: mediaFbids } : {}),
          ...(link ? { link: link } : {}),
          message: message,
          published: true,
        }),
      },
      'finalize upload'
    );
    return response.json();
  }

  override async post(
    postDetails: PostWithAllData,
    comments: PostWithAllData[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content, settings, postFormat } = this.getPlatformData(postDetails);
      let finalId = '';
      let finalUrl = '';

      const isVideo = postDetails.assets?.some(media => media.mimeType.includes('video') || media.filename.includes('.mp4'));

      if (isVideo) {
        // Pass content override to _uploadVideo
        const { id: videoId } = await this._uploadVideo(socialMediaAccount.accountId, socialMediaAccount.accessToken, postDetails, content);
        finalUrl = 'https://www.facebook.com/reel/' + videoId;
        finalId = videoId;
      } else {
        const uploadPhotos = postDetails.assets?.length
          ? await this._uploadPhotos(socialMediaAccount.accountId, socialMediaAccount.accessToken, postDetails.assets, socialMediaAccount.userId)
          : [];

        const { id: postId, permalink_url } = await this._createFeedPost(
          socialMediaAccount.accountId,
          socialMediaAccount.accessToken,
          content, // Use platform-specific content
          uploadPhotos,
          settings?.url || "" // Use link from settings if available
        );

        finalUrl = permalink_url;
        finalId = postId;
      }

      const response: PostResponse = {
        id: postDetails.id,
        postId: finalId,
        releaseURL: finalUrl,
        status: 'published',
      };

      this.emit('facebook:post:published', { postId: finalId, response });
      return response;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('facebook:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async update(
    postDetails: PostWithAllData,
    comments: PostWithAllData[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    const publicationDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
    if (!publicationDetails) {
      throw new Error('Published platform details not found');
    }
    const details = JSON.parse(publicationDetails.publishDetail as unknown as string || '{}') as PostResponse;
    const postId = details.postId;
    if (!postId) {
      throw new Error('Post details not found');
    }

    console.log(`Attempting to update Facebook post ${postId} with details:`, postDetails);

    // Facebook Page Post Update
    // POST /{post_id} with message
    const { content, settings } = this.getPlatformData(postDetails);

    // Correct URL for updating: /{post-id}
    const url = this._getGraphApiUrl(`/${postId}?access_token=${socialMediaAccount.accessToken}`);

    // Note: Link updating might not be supported via simple update call depending on post type,
    // but 'message' usually is.
    const body: any = { message: content };
    if (settings?.url) {
      // Trying to update link might fail or be ignored if it wasn't a link post
      // body.link = settings.url;
    }

    const requestApi = await this.fetch(
      url,
      {
        method: 'POST', // Updating post uses POST to the node
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      'update post'
    );

    const responseJson = await requestApi.json();
    // Facebook update response usually just { success: true } or { id: ... }?
    // Actually typically just success, ID doesn't change.

    const response: PostResponse = {
      id: postDetails.id,
      postId: postId,
      releaseURL: details.releaseURL || '',
      status: "published",
    };
    this.emit('facebook:post:updated', { postId: postDetails.id, postDetails });
    return response;
  }

  async getStatistic(
    postDetails: PostWithAllData,
    socialMediaAccount: SocialMediaAccount
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

    return this.getPostInsights(postId, socialMediaAccount.accessToken);
  }


  override async addComment(
    postDetails: PostWithAllData,
    commentDetails: PostWithAllData,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const url = this._getGraphApiUrl(`/${socialMediaAccount.accountId}/comments?access_token=${socialMediaAccount.accessToken}&fields=id,permalink_url`);
      const { id: commentId, permalink_url } = await (
        await this.fetch(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...(commentDetails.assets?.length && commentDetails.assets[0]?.url
                ? { attachment_url: commentDetails.assets[0].url }
                : {}),
              message: commentDetails.content,
            }),
          },
          'add comment'
        )
      ).json() as { id: string; permalink_url: string };

      const response: PostResponse = {
        id: commentDetails.id,
        postId: commentId,
        releaseURL: permalink_url,
        status: 'published',
      };
      this.emit('facebook:comment:added', { commentId, permalink_url, commentDetails });
      return response;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: commentDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('facebook:comment:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }
}
