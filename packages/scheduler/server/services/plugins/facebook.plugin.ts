import type { Asset, PostWithAllData, SocialMediaAccount } from '#layers/BaseDB/db/schema';
import type { PostResponse, } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { FacebookSettings, PlatformSettings } from '#layers/BaseScheduler/shared/platformSettings';
import dayjs from 'dayjs';
import { BaseSchedulerPlugin } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { FacebookPage } from '#layers/BaseConnect/utils/FacebookPages';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { getAccessToken } from '#layers/BaseConnect/server/utils/socialMedia';
import type { PluginPostDetails, PluginSocialMediaAccount } from '#layers/BaseScheduler/server/services/SchedulerPost.service';

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

  /**
   * Ensure the social media account has a valid access token
   */
  private async ensureValidToken(socialMediaAccount: PluginSocialMediaAccount): Promise<string> {
    if (socialMediaAccountService.isTokenExpired(socialMediaAccount as SocialMediaAccount)) {
      console.log('Refreshing Facebook token for account:', socialMediaAccount.id);
      const newToken = await getAccessToken(this.pluginName as any, socialMediaAccount.id);

      if (newToken) {
        socialMediaAccount.accessToken = newToken;
        await socialMediaAccountService.updateAccount(socialMediaAccount.id, {
          accessToken: newToken,
        });
      }
    }
    return socialMediaAccount.accessToken;
  }

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
    const platformSettings = (postDetails.platformSettings as any)[platformName] as FacebookSettings | undefined;
    const rawContent = platformContent?.content || postDetails.content;
    const postFormat = (postDetails as any).postFormat || 'post';

    return {
      content: this.normalizeContent(rawContent),
      settings: platformSettings,
      postFormat: postFormat
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
    'getLatestComments',
    'getCommentCount',
    'replyToComment',
    'deleteComment',
    'hideComment',
    'updateComment',
    'addCommentToPost',
    'getTaggedPosts',
    'getMentions',
    'getConversations',
    'replyToConversation',
    'getPageImpressionsUnique',
    'getPageReviews',
    'createPost',
    'postToGroup',
    'publishPhoto',
    'publishVideo',
    'publishReel',
    'getVideoInsights',
    'getReelInsights',
  ] as const;


  private readonly API_VERSION = 'v24.0';
  private readonly GRAPH_API_BASE_URL = 'https://graph.facebook.com';
  private readonly OAUTH_DIALOG_URL = 'https://www.facebook.com/v20.0/dialog/oauth';
  private readonly baseUrl = process.env.NUXT_BASE_URL || 'http://localhost:3000'

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
        await this.logPluginEvent('fetch-error:response', 'failure', `Error: ${errorBody}, Context: ${context}`, url, { options });
        throw new Error(`Facebook API Error (${context}): ${errorBody}`);
      }
      return response;
    } catch (error) {
      console.error(`Network or Fetch Error (${context}):`, error);
      await this.logPluginEvent('fetch-error', 'failure', `Error: ${(error as Error).message}, Context: ${context}`, url, { options });
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

  async pages(_: any, accessToken: string): Promise<FacebookPage[]> {
    const url = this._getGraphApiUrl(`/me/accounts?fields=id,instagram_business_account,username,name,picture.type(large)&access_token=${accessToken}`);
    const { data }: { data: FacebookPage[] } = await (
      await this.fetch(url, undefined, 'fetch pages')
    ).json();
    // Fetch all images concurrently before returning the response
    const imagePromises = data.map(page => fetchedImageBase64(page.picture.data.url));
    const imageBase64s = await Promise.all(imagePromises);

    const pages: FacebookPage[] = data.map((page, index) => ({
      imageBase64: imageBase64s[index],
      id: page.id,
      name: page.name,
      picture: {
        data: {
          height: page.picture.data.height,
          is_silhouette: page.picture.data.is_silhouette,
          width: page.picture.data.width,
          url: page.picture.data.url,
        },
      },
    }));

    // Fetch instagram business accounts concurrently before returning the response
    const instagramPagesPromises = await Promise.all(
      data.filter(page => page.instagram_business_account)
        .map(async (page) => {

          if (!page.instagram_business_account) {
            return null;
          }
          const url = this._getGraphApiUrl(`/${page.instagram_business_account.id}?fields=name,profile_picture_url&access_token=${accessToken}&limit=500`);

          const p: { name: string, profile_picture_url: string } = await (
            await this.fetch(url, undefined, 'fetch instagram pages')
          ).json();
          return {
            ...p,
            id: page.id,
            name: page.name,
            instagram_business_account: page.instagram_business_account,
            picture: {
              data: {
                height: page.picture.data.height,
                is_silhouette: page.picture.data.is_silhouette,
                width: page.picture.data.width,
                url: p.profile_picture_url,
              },
            }
          }
        }));
    //Get instagram images
    const instagramImagePromises = instagramPagesPromises.filter(page => page !== null)
      .map(page => fetchedImageBase64(page.picture.data.url));
    const instagramImageBase64s = await Promise.all(instagramImagePromises);

    const instagramPages = instagramPagesPromises.filter(page => page !== null)
      .map((page, index) => ({
        imageBase64: instagramImageBase64s[index],
        id: page.id,
        name: page.name,
        instagram_business_account: page.instagram_business_account,
        picture: {
          data: {
            height: page.picture.data.height,
            is_silhouette: page.picture.data.is_silhouette,
            width: page.picture.data.width,
            url: page.picture.data.url,
          },
        },
      }));

    pages.push(...instagramPages);

    return pages;
  }

  async fetchPageInformation(_: FacebookPlugin, pageId: string, accessToken: string, options?: { instagramId?: string }): Promise<{
    id: string;
    name: string;
    access_token: string;
    picture: string;
    username: string;
  }> {

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
    // Check if options for instagram is set
    const instagramId = options?.instagramId;
    if (instagramId) {
      const instagramUrl = this._getGraphApiUrl(`/${instagramId}?fields=username,name,profile_picture_url&access_token=${accessToken}`);
      const {
        name,
        username,
        profile_picture_url
      } = await (
        await this.fetch(instagramUrl, undefined, 'fetch page information')
      ).json();
      const base64Picture = await fetchedImageBase64(profile_picture_url);

      return {
        id: instagramId,
        name,
        access_token,
        picture: base64Picture,
        username,
      };
    } else {
      const base64Picture = await fetchedImageBase64(pictureUrl);

      return {
        id,
        name,
        access_token,
        picture: base64Picture,
        username,
      };
    }

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
        if (!media.mimeType.includes('image') && !media.mimeType.includes('video')) {
          errors.push(`Unsupported media type: ${media.mimeType}, only image and video allowed`);
        }
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
    if (!theFirstVideoFromThePost) {
      throw new Error('No video found in the post');
    }
    const url = this._getGraphApiUrl(`/${accountId}/videos?access_token=${accessToken}&fields=id,permalink_url`);
    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: getPublicUrlForAsset(theFirstVideoFromThePost.url || ''),
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
              url: getPublicUrlForAsset(m.url),
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
    return await this.createPost({
      pageId: accountId,
      message,
      accessToken,
      mediaFbids,
      options: {
        link,
        formatting: 'MARKDOWN',
        published: true,
      }
    });
  }

  override async post(
    postDetails: PostWithAllData,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      // Ensure token is valid
      await this.ensureValidToken(socialMediaAccount);
      const { content, settings, postFormat } = this.getPlatformData(postDetails);

      let finalId = '';
      let finalUrl = '';

      // Check for video/media assets
      const videoAsset = postDetails.assets?.find(media =>
        media.mimeType.includes('video') || media.filename.includes('.mp4')
      );
      const photoAssets = postDetails.assets?.filter(media =>
        media.mimeType.includes('image') ||
        media.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );

      // Determine post type based on postFormat setting or media type
      const effectiveFormat = postFormat || (videoAsset ? 'video' : 'post');

      switch (effectiveFormat) {
        case 'reel': {
          // Publish as a Facebook Reel
          if (!videoAsset) {
            throw new Error('Reel requires a video asset');
          }
          const videoUrl = getPublicUrlForAsset(videoAsset.url);
          const { video_id, success } = await this.publishReel(
            socialMediaAccount.accountId,
            videoUrl,
            socialMediaAccount.accessToken,
            content
          );
          if (!success) {
            throw new Error('Failed to publish reel');
          }
          finalId = video_id;
          finalUrl = `https://www.facebook.com/reel/${video_id}`;
          break;
        }

        case 'video': {
          // Publish as a regular Facebook Video
          if (!videoAsset) {
            throw new Error('Video post requires a video asset');
          }
          const videoUrl = getPublicUrlForAsset(videoAsset.url);
          const { id: videoId, permalink_url } = await this.publishVideo(
            socialMediaAccount.accountId,
            videoUrl,
            socialMediaAccount.accessToken,
            content
          );
          finalId = videoId;
          finalUrl = permalink_url || `https://www.facebook.com/watch/?v=${videoId}`;
          break;
        }

        case 'photo': {
          // Publish as a single photo post
          if (!photoAssets?.length) {
            throw new Error('Photo post requires an image asset');
          }
          await Promise.all(
            photoAssets.map(async (photoAsset) => {
              const photoUrl = getPublicUrlForAsset(photoAsset.url);
              const { id: photoId, post_id } = await this.publishPhoto(
                socialMediaAccount.accountId,
                photoUrl,
                socialMediaAccount.accessToken,
                content
              );
              finalId = post_id || photoId;
              finalUrl = `https://www.facebook.com/photo/?fbid=${photoId}`;
            })
          );
          break;
        }

        case 'post':
        default: {
          // Regular feed post (may include photos as attachments)
          // Check if there's a video - if so, use the old video upload method for feed posts
          if (videoAsset) {
            const { id: videoId } = await this._uploadVideo(
              socialMediaAccount.accountId,
              socialMediaAccount.accessToken,
              postDetails,
              content
            );
            finalUrl = `https://www.facebook.com/watch/?v=${videoId}`;
            finalId = videoId;
          } else {
            // Upload photos if any
            const uploadPhotos = photoAssets?.length
              ? await this._uploadPhotos(
                socialMediaAccount.accountId,
                socialMediaAccount.accessToken,
                photoAssets,
                socialMediaAccount.userId
              )
              : [];

            // Create feed post with optional photos and link
            const { id: postId, permalink_url } = await this._createFeedPost(
              socialMediaAccount.accountId,
              socialMediaAccount.accessToken,
              content,
              uploadPhotos,
              settings?.url || ''
            );

            finalUrl = permalink_url;
            finalId = postId;
          }
          break;
        }
      }
      const response: PostResponse = {
        id: postDetails.id,
        postId: finalId,
        releaseURL: finalUrl,
        status: 'published',
      };

      this.emit('facebook:post:published', { postId: finalId, response, format: effectiveFormat });

      // Publish comments after the main post is ready
      if (comments && comments.length > 0) {
        await this.publishComments(response, comments, socialMediaAccount);
      }

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
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      // Ensure token is valid
      const accessToken = await this.ensureValidToken(socialMediaAccount);

      const url = this._getGraphApiUrl(`/${postDetails.postId}/comments?access_token=${accessToken}&fields=id,permalink_url`);
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

  // ===========================================
  // NEW METHODS - Comments Management
  // ===========================================

  /**
   * Add a comment to a page post
   * Supports markdown formatting: **bold**, *italic*, `code`, ```code block```, [link](url), * list, 1. numbered, > quote
   * @param postId The page post ID to comment on
   * @param message The comment message (supports markdown)
   * @param accessToken The page access token
   * @param options Additional options (formatting)
   * @returns The comment ID and success status
   */
  async addCommentToPost(
    postId: string,
    message: string,
    accessToken: string,
    options?: {
      /** Set to 'MARKDOWN' to enable markdown formatting in the comment */
      formatting?: 'PLAINTEXT' | 'MARKDOWN';
    }
  ): Promise<{ id: string; success: boolean }> {
    const url = this._getGraphApiUrl(`/${postId}/comments?access_token=${accessToken}`);

    const body: Record<string, any> = {
      message: message,
    };

    // Add formatting type if specified (MARKDOWN enables markdown support)
    if (options?.formatting) {
      body.formatting = options.formatting;
    }

    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      'add comment to post'
    );
    const result = await response.json();
    return { id: result.id, success: !!result.id };
  }

  /**
   * Get the latest comments from a post (default: last 20)
   * @param objectId The post or object ID to get comments from
   * @param accessToken The page access token
   * @param limit Number of comments to retrieve (default: 20)
   * @returns Array of comments with their details
   */
  async getLatestComments(
    objectId: string,
    accessToken: string,
    limit: number = 20
  ): Promise<{
    data: Array<{
      id: string;
      message: string;
      from?: { name: string; id: string };
      created_time: string;
      like_count?: number;
      comment_count?: number;
    }>;
    paging?: { cursors: { before: string; after: string } };
  }> {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,message,from,created_time,like_count,comment_count',
      limit: String(limit),
      order: 'reverse_chronological',
    });

    const url = this._getGraphApiUrl(`/${objectId}/comments?${params.toString()}`);
    const response = await this.fetch(url, undefined, 'get latest comments');
    return response.json();
  }

  /**
   * Update an existing comment
   * @param commentId The comment ID to update
   * @param message The new message content
   * @param accessToken The page access token
   * @returns Success status
   */
  async updateComment(
    commentId: string,
    message: string,
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
          message: message,
        }),
      },
      'update comment'
    );
    return response.json();
  }

  // ===========================================
  // NEW METHODS - Page Insights
  // ===========================================

  /**
   * Get page impressions unique metric (reach)
   * @param pageId The page ID
   * @param accessToken The page access token
   * @param period The period: 'day', 'week', or 'days_28'
   * @param days Number of days to look back (default: 30)
   * @returns Page impressions unique data
   */
  async getPageImpressionsUnique(
    pageId: string,
    accessToken: string,
    period: 'day' | 'week' | 'days_28' = 'day',
    days: number = 30
  ): Promise<{
    name: string;
    period: string;
    values: Array<{ value: number; end_time: string }>;
    title: string;
    description: string;
  }> {
    const until = dayjs().endOf('day').unix();
    const since = dayjs().subtract(days, 'day').unix();

    const url = this._getGraphApiUrl(
      `/${pageId}/insights/page_impressions_unique?access_token=${accessToken}&period=${period}&since=${since}&until=${until}`
    );
    const { data } = await (await this.fetch(url, undefined, 'get page impressions unique')).json();

    // Return the data for the specified period
    return data?.find((d: any) => d.period === period) || data?.[0] || {};
  }

  // ===========================================
  // NEW METHODS - Page Reviews
  // ===========================================

  /**
   * Get page reviews/ratings
   * @param pageId The page ID
   * @param accessToken The page access token
   * @param options Pagination options
   * @returns Array of reviews with reviewer details
   */
  async getPageReviews(
    pageId: string,
    accessToken: string,
    options?: { limit?: number; after?: string }
  ): Promise<{
    data: Array<{
      created_time: string;
      recommendation_type: 'positive' | 'negative';
      review_text?: string;
      reviewer: { name: string; id: string };
    }>;
    paging?: { cursors: { before: string; after: string }; next?: string };
  }> {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'created_time,recommendation_type,review_text,reviewer',
      limit: String(options?.limit || 25),
      ...(options?.after ? { after: options.after } : {}),
    });

    const url = this._getGraphApiUrl(`/${pageId}/ratings?${params.toString()}`);
    const response = await this.fetch(url, undefined, 'get page reviews');
    return response.json();
  }

  // ===========================================
  // NEW METHODS - Post Management
  // ===========================================

  /**
   * Create a post on a Facebook page with automatic link detection
   * Supports markdown formatting: **bold**, *italic*, `code`, ```code block```, [link](url), * list, 1. numbered, > quote
   * @param pageId The page ID
   * @param message The post message (supports markdown)
   * @param accessToken The page access token
   * @param options Additional options (link, scheduled_publish_time, published, formatting)
   * @returns The post ID and permalink
   */
  async createPost({
    pageId,
    message,
    accessToken,
    mediaFbids,
    options
  }: {
    pageId: string,
    message: string,
    accessToken: string,
    mediaFbids: { media_fbid: string }[],
    options?: {
      link?: string;
      published?: boolean;
      scheduled_publish_time?: number;
      /** Set to 'MARKDOWN' to enable markdown formatting in the post */
      formatting?: 'PLAINTEXT' | 'MARKDOWN';
    }
  }
  ): Promise<{ id: string; permalink_url: string }> {
    // Auto-detect link in message if not explicitly provided
    let link = options?.link;
    if (!link) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const match = message.match(urlRegex);
      if (match && match.length > 0) {
        link = match[0];
      }
    }

    const url = this._getGraphApiUrl(`/${pageId}/feed?access_token=${accessToken}&fields=id,permalink_url`);
    const body: Record<string, any> = {
      message: message,
      published: options?.published ?? true,
    };

    // Add formatting type if specified (MARKDOWN enables markdown support)
    if (options?.formatting) {
      body.formatting = options.formatting;
    }

    if (link) {
      body.link = link;
    }

    if (options?.scheduled_publish_time) {
      body.published = false;
      body.scheduled_publish_time = options.scheduled_publish_time;
    }
    if (mediaFbids?.length) {
      body.attached_media = mediaFbids;
    }

    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      'create post'
    );
    return response.json();
  }

  /**
   * Post to a Facebook group
   * Supports markdown formatting: **bold**, *italic*, `code`, ```code block```, [link](url), * list, 1. numbered, > quote
   * @param groupId The group ID
   * @param message The post message (supports markdown)
   * @param accessToken The access token
   * @param options Additional options (link, formatting)
   * @returns The post ID
   */
  async postToGroup(
    groupId: string,
    message: string,
    accessToken: string,
    options?: {
      link?: string;
      /** Set to 'MARKDOWN' to enable markdown formatting in the post */
      formatting?: 'PLAINTEXT' | 'MARKDOWN';
    }
  ): Promise<{ id: string }> {
    // Auto-detect link in message if not explicitly provided
    let link = options?.link;
    if (!link) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const match = message.match(urlRegex);
      if (match && match.length > 0) {
        link = match[0];
      }
    }

    const url = this._getGraphApiUrl(`/${groupId}/feed?access_token=${accessToken}`);
    const body: Record<string, any> = {
      message: message,
    };

    // Add formatting type if specified (MARKDOWN enables markdown support)
    if (options?.formatting) {
      body.formatting = options.formatting;
    }

    if (link) {
      body.link = link;
    }

    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      'post to group'
    );
    return response.json();
  }

  /**
   * Publish a single photo to a Facebook page
   * @param pageId The page ID
   * @param photoUrl URL of the photo to publish
   * @param accessToken The page access token
   * @param caption Optional caption for the photo
   * @returns The photo ID and post ID
   */
  async publishPhoto(
    pageId: string,
    photoUrl: string,
    accessToken: string,
    caption?: string
  ): Promise<{ id: string; post_id?: string }> {
    const url = this._getGraphApiUrl(`/${pageId}/photos?access_token=${accessToken}`);
    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: photoUrl,
          caption: caption || '',
          published: true,
        }),
      },
      'publish photo'
    );
    return response.json();
  }

  // ===========================================
  // NEW METHODS - Video Publishing
  // ===========================================

  /**
   * Publish a video to a Facebook page
   * @param pageId The page ID
   * @param videoUrl URL of the video to publish
   * @param accessToken The page access token
   * @param description Optional description for the video
   * @param title Optional title for the video
   * @returns The video ID and permalink
   */
  async publishVideo(
    pageId: string,
    videoUrl: string,
    accessToken: string,
    description?: string,
    title?: string
  ): Promise<{ id: string; permalink_url?: string }> {
    const url = this._getGraphApiUrl(`/${pageId}/videos?access_token=${accessToken}&fields=id,permalink_url`);
    const response = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: videoUrl,
          description: description || '',
          title: title || '',
          published: true,
        }),
      },
      'publish video'
    );
    return response.json();
  }

  // ===========================================
  // NEW METHODS - Reels Publishing
  // ===========================================

  /**
   * Publish a reel to a Facebook page (3-step process)
   * Step 1: Initialize upload session
   * Step 2: Upload video to rupload.facebook.com
   * Step 3: Publish the reel
   * @param pageId The page ID
   * @param videoUrl URL of the video file (hosted on public server)
   * @param accessToken The page access token
   * @param description Optional description/caption for the reel
   * @returns The reel video ID and success status
   */
  async publishReel(
    pageId: string,
    videoUrl: string,
    accessToken: string,
    description?: string
  ): Promise<{ video_id: string; success: boolean }> {
    // Step 1: Initialize upload session
    const initUrl = this._getGraphApiUrl(`/${pageId}/video_reels?access_token=${accessToken}`);
    const initResponse = await this.fetch(
      initUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upload_phase: 'start',
        }),
      },
      'initialize reel upload'
    );
    const { video_id, upload_url } = await initResponse.json();

    if (!video_id) {
      throw new Error('Failed to initialize reel upload session');
    }

    // Step 2: Upload the video file to rupload.facebook.com
    const uploadResponse = await fetch(upload_url, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${accessToken}`,
        'file_url': videoUrl,
      },
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Failed to upload reel video: ${errorText}`);
    }

    // Step 3: Publish the reel
    const publishUrl = this._getGraphApiUrl(`/${pageId}/video_reels?access_token=${accessToken}`);
    const publishResponse = await this.fetch(
      publishUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: video_id,
          upload_phase: 'finish',
          video_state: 'PUBLISHED',
          description: description || '',
        }),
      },
      'publish reel'
    );
    const publishResult = await publishResponse.json();

    return { video_id, success: publishResult.success === true };
  }

  // ===========================================
  // NEW METHODS - Video/Reels Insights
  // ===========================================

  /**
   * Get video insights/metrics (non-ad related)
   * @param videoId The video ID
   * @param accessToken The page access token
   * @returns Video performance metrics
   */
  async getVideoInsights(
    videoId: string,
    accessToken: string
  ): Promise<{
    total_video_views: number;
    total_video_views_unique: number;
    total_video_complete_views: number;
    total_video_views_organic: number;
    total_video_views_organic_unique: number;
    total_video_views_sound_on: number;
    total_video_views_autoplayed: number;
    total_video_views_clicked_to_play: number;
    raw_data: any[];
  }> {
    const metrics = [
      'total_video_views',
      'total_video_views_unique',
      'total_video_complete_views',
      'total_video_views_organic',
      'total_video_views_organic_unique',
      'total_video_views_sound_on',
      'total_video_views_autoplayed',
      'total_video_views_clicked_to_play',
    ].join(',');

    const url = this._getGraphApiUrl(
      `/${videoId}/video_insights?metric=${metrics}&access_token=${accessToken}`
    );
    const { data } = await (await this.fetch(url, undefined, 'get video insights')).json();

    // Parse the response into a structured object
    const result: Record<string, number> = {
    };
    data?.forEach((metric: any) => {
      result[metric.name] = metric.values?.[0]?.value || 0;
    });

    return {
      total_video_views: result.total_video_views || 0,
      total_video_views_unique: result.total_video_views_unique || 0,
      total_video_complete_views: result.total_video_complete_views || 0,
      total_video_views_organic: result.total_video_views_organic || 0,
      total_video_views_organic_unique: result.total_video_views_organic_unique || 0,
      total_video_views_sound_on: result.total_video_views_sound_on || 0,
      total_video_views_autoplayed: result.total_video_views_autoplayed || 0,
      total_video_views_clicked_to_play: result.total_video_views_clicked_to_play || 0,
      raw_data: data || [],
    };
  }

  /**
   * Get reel insights/metrics (non-ad related)
   * Useful to determine if a video is performing well for virality
   * @param reelId The reel/video ID
   * @param accessToken The page access token
   * @returns Reel performance metrics
   */
  async getReelInsights(
    reelId: string,
    accessToken: string
  ): Promise<{
    blue_reels_play_count: number;
    fb_reels_replay_count: number;
    fb_reels_total_plays: number;
    post_impressions_unique: number;
    post_video_avg_time_watched: number;
    post_video_view_time: number;
    post_video_followers: number;
    post_video_social_actions: { comments?: number; shares?: number };
    post_video_likes_by_reaction_type: Record<string, number>;
    post_video_retention_graph: number[];
    virality_score: 'low' | 'medium' | 'high' | 'viral';
    raw_data: any[];
  }> {
    const metrics = [
      'blue_reels_play_count',
      'fb_reels_replay_count',
      'fb_reels_total_plays',
      'post_impressions_unique',
      'post_video_avg_time_watched',
      'post_video_view_time',
      'post_video_followers',
      'post_video_social_actions',
      'post_video_likes_by_reaction_type',
      'post_video_retention_graph',
    ].join(',');

    const url = this._getGraphApiUrl(
      `/${reelId}/video_insights?metric=${metrics}&access_token=${accessToken}`
    );
    const { data } = await (await this.fetch(url, undefined, 'get reel insights')).json();

    // Parse the response into a structured object
    const result: Record<string, any> = {
    };
    data?.forEach((metric: any) => {
      result[metric.name] = metric.values?.[0]?.value;
    });

    // Calculate virality score based on engagement metrics
    const playCount = result.fb_reels_total_plays || result.blue_reels_play_count || 0;
    const replayCount = result.fb_reels_replay_count || 0;
    const impressions = result.post_impressions_unique || 0;
    const followers = result.post_video_followers || 0;

    let viralityScore: 'low' | 'medium' | 'high' | 'viral' = 'low';
    const replayRate = playCount > 0 ? (replayCount / playCount) : 0;
    const followRate = impressions > 0 ? (followers / impressions) : 0;

    if (replayRate > 0.3 && followRate > 0.05) {
      viralityScore = 'viral';
    } else if (replayRate > 0.2 || followRate > 0.03) {
      viralityScore = 'high';
    } else if (replayRate > 0.1 || followRate > 0.01) {
      viralityScore = 'medium';
    }

    return {
      blue_reels_play_count: result.blue_reels_play_count || 0,
      fb_reels_replay_count: result.fb_reels_replay_count || 0,
      fb_reels_total_plays: result.fb_reels_total_plays || 0,
      post_impressions_unique: result.post_impressions_unique || 0,
      post_video_avg_time_watched: result.post_video_avg_time_watched || 0,
      post_video_view_time: result.post_video_view_time || 0,
      post_video_followers: result.post_video_followers || 0,
      post_video_social_actions: result.post_video_social_actions || {},
      post_video_likes_by_reaction_type: result.post_video_likes_by_reaction_type || {},
      post_video_retention_graph: result.post_video_retention_graph || [],
      virality_score: viralityScore,
      raw_data: data || [],
    };
  }
}
