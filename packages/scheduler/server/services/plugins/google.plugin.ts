import { BaseSchedulerPlugin, type PluginPostDetails, type PluginSocialMediaAccount, type GetCommentsResponse, type ReplyCommentResponse, type PlatformComment, type PlatformStats, type PostResponse } from '../SchedulerPost.service';
import type { Post } from '#layers/BaseDB/db/schema';
import { google, youtube_v3 } from 'googleapis';
import type { FacebookPage } from '#layers/BaseConnect/utils/FacebookPages';
import { fetchedImageBase64 } from '../../utils/ScheduleUtils';

const BUSINESS_INFO_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const ACCOUNT_MANAGEMENT_API_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1';

export class GooglePlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'google';
  readonly pluginName = 'google';

  public override exposedMethods = [
    'pages',
    'getChannels',
    'getVideoCategories',
    'getGMBLocations',
    'fetchPageInformation',
  ] as const;

  protected init(options?: Record<string, unknown>): void {
    console.log('Google plugin initialized', options);
  }

  override async validate(_post: Post): Promise<string[]> {
    return [];
  }

  async getChannels(accessToken: string, refreshToken?: string): Promise<youtube_v3.Schema$Channel[]> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth });
      const response = await youtube.channels.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        mine: true,
      });

      return response.data.items || [];
    } catch (error: unknown) {
      log.error({ content: 'Failed to fetch YouTube channels via Google', plugin: 'google', error: (error as Error).message });
      this.logPluginEvent('get-channels', 'failure', `Error: ${(error as Error).message}`);
      return [];
    }
  }

  async getVideoCategories(regionCode: string, accessToken: string, refreshToken?: string): Promise<youtube_v3.Schema$VideoCategory[]> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth });
      const response = await youtube.videoCategories.list({
        part: ['snippet'],
        regionCode: regionCode || 'US',
      });

      return response.data.items || [];
    } catch (error: unknown) {
      log.error({ content: 'Failed to fetch YouTube categories via Google', plugin: 'google', error: (error as Error).message });
      this.logPluginEvent('get-categories', 'failure', `Error: ${(error as Error).message}`);
      return [];
    }
  }

  async getGMBLocations(accessToken: string): Promise<FacebookPage[]> {
    try {
      const accountsResponse = await fetch(
        `${ACCOUNT_MANAGEMENT_API_BASE}/accounts`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        log.error({ content: 'GMB accounts API failed', plugin: 'google', status: accountsResponse.status, error: errorText });
        return [];
      }
      const accountsData = await accountsResponse.json();
      const accounts = accountsData.accounts || [];
      log.info({ content: 'GMB accounts found', count: accounts.length, accounts: accounts.map((a: { name: string }) => a.name) });

      const allLocations: FacebookPage[] = [];
      for (const gmbAccount of accounts) {
        const locationsResponse = await fetch(
          `${BUSINESS_INFO_API_BASE}/${gmbAccount.name}/locations?readMask=name,title,storefrontAddress,phoneNumbers,categories,websiteUri,profile,metadata`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!locationsResponse.ok) {
          const errorText = await locationsResponse.text();
          log.error({ content: 'GMB locations API failed', plugin: 'google', account: gmbAccount.name, status: locationsResponse.status, error: errorText });
          continue;
        }
        const locationsData = await locationsResponse.json();
        const locations = locationsData.locations || [];
        log.info({ content: 'GMB locations found', account: gmbAccount.name, count: locations.length });
        for (const location of locations) {
          const pictureUrl = location.profile?.description
            ? `https://lh3.googleusercontent.com/${location.name}`
            : '';
          allLocations.push({
            id: location.name,
            name: location.title || location.name,
            picture: {
              data: {
                url: pictureUrl,
              },
            },
          });
        }
      }

      return allLocations;
    } catch (error: unknown) {
      log.error({ content: 'Failed to fetch GMB locations via Google', plugin: 'google', error: (error as Error).message });
      return [];
    }
  }

  async pages(_: unknown, accessToken: string): Promise<(FacebookPage & { platformType: string })[]> {
    try {
      const [channels, locations] = await Promise.all([
        this.getChannels(accessToken),
        this.getGMBLocations(accessToken),
      ]);

      const youtubePages: (FacebookPage & { platformType: string })[] = channels.map(channel => ({
        id: channel.id || '',
        name: channel.snippet?.title || '',
        picture: {
          data: {
            url: channel.snippet?.thumbnails?.default?.url || '',
          },
        },
        platformType: 'youtube',
      }));

      const gmbPages: (FacebookPage & { platformType: string })[] = locations.map(loc => ({
        ...loc,
        platformType: 'googlemybusiness',
      }));

      const allPages = [...youtubePages, ...gmbPages];

      const imagePromises = allPages.map(page =>
        page.picture.data.url ? fetchedImageBase64(page.picture.data.url) : Promise.resolve(undefined)
      );
      const imageBase64s = await Promise.all(imagePromises);

      return allPages.map((page, index) => ({
        ...page,
        imageBase64: imageBase64s[index],
      }));
    } catch (error: unknown) {
      log.error({ content: 'Failed to fetch Google pages', plugin: 'google', error: (error as Error).message });
      this.logPluginEvent('get-pages', 'failure', `Error: ${(error as Error).message}`);
      return [];
    }
  }

  async fetchPageInformation(_: GooglePlugin, pageId: string, accessToken: string): Promise<{
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
      log.error({ content: 'Failed to fetch channel info via Google', plugin: 'google', error: (error as Error).message });
      this.logPluginEvent('fetch-page-information', 'failure', `Error: ${(error as Error).message}`);
      return { id: pageId, name: '', access_token: accessToken, picture: '', username: '' };
    }
  }

  override async post(
    _postDetails: PluginPostDetails,
    _comments: PluginPostDetails[],
    _socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    return {
      id: _postDetails.id,
      postId: '',
      releaseURL: '',
      status: 'failed',
      error: 'Direct posting not supported for Google connection. Use YouTube or GMB platform instead.',
    };
  }

  override async update(
    _postDetails: PluginPostDetails,
    _comments: PluginPostDetails[],
    _socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    return {
      id: _postDetails.id,
      postId: '',
      releaseURL: '',
      status: 'failed',
      error: 'Direct update not supported for Google connection.',
    };
  }

  override async addComment(
    _postDetails: PluginPostDetails,
    _commentDetails: PluginPostDetails,
    _socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    return {
      id: _commentDetails.id,
      postId: '',
      releaseURL: '',
      status: 'failed',
      error: 'Direct commenting not supported for Google connection.',
    };
  }

  override async getStatistic(
    _postDetails: PluginPostDetails,
    _socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    return {
      platform: 'google',
      accountId: _socialMediaAccount.accountId,
      username: _socialMediaAccount.accountName || '',
      fetchedAt: new Date().toISOString(),
      followers: 0,
      posts: 0,
      engagement: { total: 0 },
      growth: undefined,
    };
  }

  override async getComments(
    _postDetails: PluginPostDetails,
    _socialMediaAccount: PluginSocialMediaAccount,
    _options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    return { platform: 'google', postId: '', comments: [], hasMore: false };
  }

  override async replyToComment(
    _postDetails: PluginPostDetails,
    _socialMediaAccount: PluginSocialMediaAccount,
    _commentId: string,
    _replyText: string
  ): Promise<ReplyCommentResponse> {
    return { success: false, error: 'Comment replies not supported for Google connection.' };
  }
}
