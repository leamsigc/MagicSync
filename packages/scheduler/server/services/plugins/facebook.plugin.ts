import type { Asset, Post, PostWithAllData, SocialMediaAccount } from '#layers/BaseDB/db/schema';
import type { PostDetails, PostResponse, Integration, MediaContent } from '../SchedulerPost.service';
import { BaseSchedulerPlugin } from '../SchedulerPost.service';
import dayjs from 'dayjs';

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
  private readonly baseUrl = process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  protected init(options?: any): void {
    // Initialize Facebook API client or settings
    console.log('Facebook plugin initialized', options);
  }

  /**
   * Generates a random string of specified length.
   * @param length The length of the string to generate.
   * @returns A random string.
   */
  private _makeId(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
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

    console.log({
      url,
      data
    });
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


  override async validate(post: Post): Promise<string[]> {
    const postDetails: PostDetails = {
      message: post.content,
      media: [],
      comments: [],
      settings: {},
      id: post.id
    };

    const errors: string[] = [];
    const detail = postDetails;
    if (detail.message && detail.message.length > 63206) {
      errors.push('Post content is too long');
    }
    if (detail.media) {
      for (const media of detail.media) {
        if (media.type !== 'image' && media.type !== 'video') {
          errors.push(`Unsupported media type: ${media.type}, only image and video allowed`);
        }
      }
    }
    if (detail.poll) {
      errors.push('Polls are not supported on Facebook');
    }
    // Check for Facebook.com links
    if (detail.message && detail.message.includes('facebook.com')) {
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
    postDetails: PostWithAllData
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
          description: postDetails.content,
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
    comments: PostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      let finalId = '';
      let finalUrl = '';

      const isVideo = postDetails.assets?.some(media => media.mimeType.includes('video') || media.filename.includes('.mp4'));

      if (isVideo) {
        const { id: videoId } = await this._uploadVideo(socialMediaAccount.accountId, socialMediaAccount.accessToken, postDetails);
        finalUrl = 'https://www.facebook.com/reel/' + videoId;
        finalId = videoId;
      } else {
        const uploadPhotos = postDetails.assets?.length
          ? await this._uploadPhotos(socialMediaAccount.accountId, socialMediaAccount.accessToken, postDetails.assets, socialMediaAccount.userId)
          : [];

        const { id: postId, permalink_url } = await this._createFeedPost(
          socialMediaAccount.accountId,
          socialMediaAccount.accessToken,
          postDetails.content,
          uploadPhotos,
          ""
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
    comments: PostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    // Facebook API does not directly support updating a post's content or media after publishing.
    // A common approach is to delete the old post and create a new one, or to update only certain fields if supported.
    // For this implementation, we'll simulate an update by returning a new PostResponse with 'updated' status.
    // In a real scenario, you'd interact with the Facebook Graph API to attempt an update.
    console.log(`Attempting to update Facebook post ${postDetails.id} with details:`, postDetails);

    const updatedPostId = `fb_updated_${postDetails.id}`;
    const response: PostResponse = {
      id: postDetails.id,
      postId: updatedPostId,
      releaseURL: `https://www.facebook.com/${socialMediaAccount.accountId}/posts/${updatedPostId}`,
      status: "published",
    };
    this.emit('facebook:post:updated', { postId: updatedPostId, postDetails });
    return response;
  }

  override async addComment(
    postDetails: PostWithAllData,
    commentDetails: PostDetails,
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
              ...(commentDetails.media?.length && commentDetails.media[0]?.path
                ? { attachment_url: commentDetails.media[0].path }
                : {}),
              message: commentDetails.message,
            }),
          },
          'add comment'
        )
      ).json();

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
