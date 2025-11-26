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
    'refreshToken',
    'generateAuthUrl',
    'reConnect',
    'authenticate',
    'pages',
    'fetchPageInformation',
    'analytics',
  ];

  private readonly API_VERSION = 'v20.0';
  private readonly GRAPH_API_BASE_URL = 'https://graph.facebook.com';
  private readonly OAUTH_DIALOG_URL = 'https://www.facebook.com/v20.0/dialog/oauth';

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

  async refreshToken(refresh_token: string): Promise<AuthTokenDetails> {
    // Facebook does not use refresh tokens in the same way as other platforms.
    // Long-lived access tokens are exchanged for short-lived ones.
    // The provided FacebookProvider example returns empty values, so we'll follow that.
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  async generateAuthUrl() {
    const state = this._makeId(6);
    const scopes = [
      'pages_show_list',
      'business_management',
      'pages_manage_posts',
      'pages_manage_engagement',
      'pages_read_engagement',
      'read_insights',
    ];
    return {
      url:
        `${this.OAUTH_DIALOG_URL}` +
        `?client_id=${process.env.FACEBOOK_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(
          `${process.env.FRONTEND_URL}/integrations/social/facebook`
        )}` +
        `&state=${state}` +
        `&scope=${scopes.join(',')}`,
      codeVerifier: this._makeId(10),
      state,
    };
  }

  async reConnect(
    id: string,
    requiredId: string,
    accessToken: string
  ): Promise<AuthTokenDetails> {
    const information = await this.fetchPageInformation(
      this,
      accessToken,
      requiredId
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

  /**
   * Fetches a short-lived access token from Facebook.
   * @param code The authorization code.
   * @param redirectUri The redirect URI used in the authorization flow.
   * @param refresh Optional refresh parameter.
   * @returns The access token response.
   */
  private async _getShortLivedAccessToken(
    code: string,
    redirectUri: string,
    refresh?: string
  ): Promise<{ access_token: string; expires_in: number }> {
    const url =
      this._getGraphApiUrl('/oauth/access_token') +
      `?client_id=${process.env.FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(
        `${redirectUri}${refresh ? `?refresh=${refresh}` : ''}`
      )}` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&code=${code}`;
    const response = await this.fetch(url, undefined, 'get short-lived access token');
    return response.json();
  }

  /**
   * Exchanges a short-lived access token for a long-lived one.
   * @param shortLivedToken The short-lived access token.
   * @returns The long-lived access token.
   */
  private async _getLongLivedAccessToken(shortLivedToken: string): Promise<string> {
    const url =
      this._getGraphApiUrl('/oauth/access_token') +
      '?grant_type=fb_exchange_token' +
      `&client_id=${process.env.FACEBOOK_APP_ID}` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&fb_exchange_token=${shortLivedToken}&fields=access_token,expires_in`;
    const response = await this.fetch(url, undefined, 'get long-lived access token');
    const { access_token } = await response.json();
    return access_token;
  }

  /**
   * Checks if the granted permissions include all required scopes.
   * @param accessToken The user's access token.
   * @param requiredScopes An array of required permission scopes.
   * @throws Error if any required permissions are missing.
   */
  private async _checkPermissions(accessToken: string, requiredScopes: string[]): Promise<void> {
    const url = this._getGraphApiUrl(`/me/permissions?access_token=${accessToken}`);
    const response = await this.fetch(url, undefined, 'check permissions');
    const { data } = await response.json();

    const grantedPermissions = data
      .filter((d: any) => d.status === 'granted')
      .map((p: any) => p.permission);

    const missingScopes = requiredScopes.filter(scope => !grantedPermissions.includes(scope));
    if (missingScopes.length > 0) {
      throw new Error(`Missing required permissions: ${missingScopes.join(', ')}`);
    }
  }

  /**
   * Fetches user information (id, name, picture) for the authenticated user.
   * @param accessToken The user's access token.
   * @returns User details.
   */
  private async _fetchMe(accessToken: string): Promise<{ id: string; name: string; picture: { data: { url: string } } }> {
    const url = this._getGraphApiUrl(`/me?fields=id,name,picture&access_token=${accessToken}`);
    const response = await this.fetch(url, undefined, 'fetch user info');
    return response.json();
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }) {
    const redirectUri = `${process.env.FRONTEND_URL}/integrations/social/facebook`;

    const { access_token: shortLivedAccessToken } = await this._getShortLivedAccessToken(
      params.code,
      redirectUri,
      params.refresh
    );

    const longLivedAccessToken = await this._getLongLivedAccessToken(shortLivedAccessToken);

    const scopes = [
      'pages_show_list',
      'business_management',
      'pages_manage_posts',
      'pages_manage_engagement',
      'pages_read_engagement',
      'read_insights',
    ];
    await this._checkPermissions(longLivedAccessToken, scopes);

    const { id, name, picture } = await this._fetchMe(longLivedAccessToken);

    return {
      id,
      name,
      accessToken: longLivedAccessToken,
      refreshToken: longLivedAccessToken, // Facebook uses long-lived access tokens as refresh tokens
      expiresIn: dayjs().add(59, 'days').unix() - dayjs().unix(), // Long-lived tokens last 60 days
      picture: picture?.data?.url || '',
      username: '',
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
    postDetails: PostDetails
  ): Promise<{ id: string; permalink_url: string }> {
    const url = this._getGraphApiUrl(`/${accountId}/videos?access_token=${accessToken}&fields=id,permalink_url`);
    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: postDetails.media?.[0]?.path!,
          description: postDetails.message,
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
    const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000'
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
              url: `${baseUrl}${m.url.replace('/serve/', '/public/')}?userId=${userId}`,
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

      const isVideo = postDetails.assets?.some(media => media.mimeType === 'video' || media.filename.includes('.mp4'));

      if (isVideo) {
        // const { id: videoId } = await this._uploadVideo(socialMediaAccount.accountId, socialMediaAccount.accessToken, postDetails);
        // finalUrl = 'https://www.facebook.com/reel/' + videoId;
        // finalId = videoId;
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
