import type { Asset, Post, PostWithAllData, SocialMediaAccount } from '#layers/BaseDB/db/schema';
import type { PluginPostDetails, PluginSocialMediaAccount, PostResponse, GetCommentsResponse, ReplyCommentResponse, PlatformComment, PlatformStats } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { BaseSchedulerPlugin } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import dayjs from 'dayjs';

// Type definitions for Google My Business API responses
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

type GMBLocation = {
  id: string;
  name: string;
  title: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  phoneNumbers?: {
    primaryPhone?: string;
  };
  categories?: {
    primaryCategory?: {
      displayName?: string;
    };
  };
  websiteUri?: string;
  regularHours?: Record<string, unknown>;
  profile?: {
    description?: string;
  };
  metadata?: {
    mapsUri?: string;
  };
};

type GMBReview = {
  name: string;
  reviewId: string;
  reviewer: {
    profilePhotoUrl?: string;
    displayName?: string;
    isAnonymous?: boolean;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
};

type GMBPostType = 'EVENT' | 'OFFER' | 'STANDARD';

type GMBPostData = {
  topicType: GMBPostType;
  summary?: string;
  event?: {
    title: string;
    schedule: {
      startDate: { year: number; month: number; day: number };
      startTime?: { hours: number; minutes: number };
      endDate: { year: number; month: number; day: number };
      endTime?: { hours: number; minutes: number };
    };
  };
  offer?: {
    couponCode?: string;
    redeemOnlineUrl?: string;
    termsConditions?: string;
  };
  callToAction?: {
    actionType: 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';
    url?: string;
  };
  media?: Array<{
    mediaFormat: 'PHOTO' | 'VIDEO';
    sourceUrl: string;
  }>;
};

export class GoogleMyBusinessPlugin extends BaseSchedulerPlugin {
  override async getStatistic(_postDetails: PluginPostDetails, socialMediaAccount: PluginSocialMediaAccount): Promise<PlatformStats> {
    try {
      const accessToken = socialMediaAccount.accessToken;

      if (!accessToken) {
        console.error('[GoogleMyBusiness] No access token found');
        return this.createZeroStats(socialMediaAccount);
      }

      const accountsResponse = await fetch(
        `${this.BUSINESS_INFO_API_BASE}/accounts`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!accountsResponse.ok) {
        const errorBody = await accountsResponse.text();
        console.error(`[GoogleMyBusiness] Failed to fetch accounts: ${accountsResponse.status} - ${errorBody}`);
        return this.createZeroStats(socialMediaAccount);
      }

      const accountsData = await accountsResponse.json();
      const accounts = accountsData.accounts || [];

      if (accounts.length === 0) {
        return this.createZeroStats(socialMediaAccount);
      }

      const accountName = accounts[0].name;

      const locationsResponse = await fetch(
        `${this.ACCOUNT_MANAGEMENT_API_BASE}/${accountName}/locations`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!locationsResponse.ok) {
        const errorBody = await locationsResponse.text();
        console.error(`[GoogleMyBusiness] Failed to fetch locations: ${locationsResponse.status} - ${errorBody}`);
        return this.createZeroStats(socialMediaAccount);
      }

      const locationsData = await locationsResponse.json();
      const locations = locationsData.locations || [];
      const locationCount = locations.length

      let totalImpressions = 0
      let searchImpressions = 0
      let mapsImpressions = 0
      let websiteClicks = 0
      let callClicks = 0
      let directionRequests = 0
      let bookingRequests = 0
      let totalEngagement = 0
      let keywordData: Array<{ keyword: string; impressions: number }> = []

      const firstLocation = locations[0]
      if (firstLocation?.name) {
        try {
          const perfUrl = `${this.PERFORMANCE_API_BASE}/${firstLocation.name}/`

          const insightsResponse = await fetch(
            `${perfUrl}insights?dailyRange.startDate.year=2026&dailyRange.startDate.month=1&dailyRange.startDate.day=1&dailyRange.endDate.year=2026&dailyRange.endDate.month=6&dailyRange.endDate.day=4`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )

          if (insightsResponse.ok) {
            const insightsData = await insightsResponse.json()
            const metrics = insightsData.insights || []

            for (const metric of metrics) {
              const metricValues = metric.value || {}

              switch (metric.metricType) {
                case 'ALL_IMPRESSIONS':
                  totalImpressions += metricValues.count || 0
                  break
                case 'SEARCH_IMPRESSIONS':
                  searchImpressions += metricValues.count || 0
                  break
                case 'MAPS_IMPRESSIONS':
                  mapsImpressions += metricValues.count || 0
                  break
                case 'WEBSITE_CLICKS':
                  websiteClicks += metricValues.count || 0
                  break
                case 'CALL_CLICKS':
                  callClicks += metricValues.count || 0
                  break
                case 'DIRECTION_REQUESTS':
                  directionRequests += metricValues.count || 0
                  break
                case 'BOOKING_CLICKS':
                  bookingRequests += metricValues.count || 0
                  break
              }
            }
          }
        } catch {
        }

        try {
          const keywordsResponse = await fetch(
            `${this.PERFORMANCE_API_BASE}/${firstLocation.name}/searchkeywords/impressions/monthly`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )

          if (keywordsResponse.ok) {
            const kwData = await keywordsResponse.json()
            keywordData = (kwData.searchKeywordsCounts || []).map(
              (item: { keyword?: { name?: string }; insightsValue?: { value?: number } }) => ({
                keyword: item.keyword?.name?.split('/').pop() || 'unknown',
                impressions: item.insightsValue?.value || 0,
              })
            )
          }
        } catch {
        }
      }

      totalEngagement = websiteClicks + callClicks + directionRequests + bookingRequests

      return {
        platform: 'googlemybusiness',
        accountId: socialMediaAccount.accountId || '',
        username: socialMediaAccount.username || socialMediaAccount.accountName || '',
        fetchedAt: new Date().toISOString(),
        followers: locationCount,
        posts: locationCount,
        engagement: {
          total: totalEngagement,
          impressions: totalImpressions,
          reach: searchImpressions + mapsImpressions,
        },
        growth: {
          followers: { absolute: 0, percentage: 0 },
          posts: { absolute: 0, percentage: 0 },
          engagement: { absolute: totalEngagement, percentage: 0 },
        },
        extra: {
          locationCount,
          searchImpressions,
          mapsImpressions,
          totalImpressions,
          websiteClicks,
          callClicks,
          directionRequests,
          bookingRequests,
          topKeywords: keywordData.slice(0, 20),
          keywordCount: keywordData.length,
        },
      };
    } catch (error: unknown) {
      console.error('[GoogleMyBusiness] Error fetching stats:', error);
      return this.createZeroStats(socialMediaAccount);
    }
  }

  private createZeroStats(socialMediaAccount: PluginSocialMediaAccount): PlatformStats {
    return {
      platform: 'googlemybusiness',
      accountId: socialMediaAccount.accountId || '',
      username: socialMediaAccount.username || socialMediaAccount.accountName || '',
      fetchedAt: new Date().toISOString(),
      followers: 0,
      posts: 0,
    };
  }

  static readonly pluginName = 'googlemybusiness';
  readonly pluginName = 'googlemybusiness';

  private getPlatformData(postDetails: PostWithAllData) {
    const platformName = this.pluginName;
    const platformContent = (postDetails.platformContent as Record<string, { content: string; comments?: string[] } | undefined>)?.[platformName];
    const platformSettings = (postDetails.platformSettings as Record<string, unknown>)?.[platformName] as GoogleBusinessSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings: platformSettings,
      postFormat: postDetails.postFormat || 'post'
    };
  }

  public override exposedMethods = [
    'handleErrors',
    'reConnect',
    'getLocations',
    'getLocation',
    'createPost',
    'getAnalytics',
    'getReviews',
    'getLatestReviews',
    'replyToReview',
    'deleteReviewReply',
  ];

  private readonly BUSINESS_INFO_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
  private readonly ACCOUNT_MANAGEMENT_API_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1';
  private readonly PERFORMANCE_API_BASE = 'https://businessprofileperformance.googleapis.com/v1';
  private readonly baseUrl = process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  protected init(options?: Record<string, unknown>): void {
    console.log('Google My Business plugin initialized', options);
  }

  /**
   * Generic fetch wrapper with error handling
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
        console.error(`GMB API Error (${context}): ${response.status} - ${errorBody}`);
        throw new Error(`GMB API Error (${context}): ${errorBody}`);
      }
      return response;
    } catch (error: unknown) {
      console.error(`Network or Fetch Error (${context}):`, error);
      throw error;
    }
  }

  /**
   * Handle Google My Business API errors
   */
  handleErrors(body: string):
    | {
      type: 'refresh-token' | 'bad-body';
      value: string;
    }
    | undefined {
    // Token errors
    if (body.indexOf('invalid_grant') > -1 || body.indexOf('Token has been expired') > -1) {
      return {
        type: 'refresh-token' as const,
        value: 'Access token expired, please re-authenticate',
      };
    }

    if (body.indexOf('UNAUTHENTICATED') > -1 || body.indexOf('401') > -1) {
      return {
        type: 'refresh-token' as const,
        value: 'Authentication required, please re-authenticate',
      };
    }

    if (body.indexOf('PERMISSION_DENIED') > -1 || body.indexOf('403') > -1) {
      return {
        type: 'refresh-token' as const,
        value: 'Permission denied, please re-authenticate with required permissions',
      };
    }

    // Content errors
    if (body.indexOf('INVALID_ARGUMENT') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Invalid post content or format',
      };
    }

    if (body.indexOf('RESOURCE_EXHAUSTED') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'API quota exceeded, please try again later',
      };
    }

    if (body.indexOf('NOT_FOUND') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Location or resource not found',
      };
    }

    return undefined;
  }

  /**
   * Reconnect to a specific location
   */
  async reConnect(
    id: string,
    requiredId: string,
    accessToken: string
  ): Promise<AuthTokenDetails> {
    const location = await this.getLocation(requiredId, accessToken);

    return {
      id: location.id,
      name: location.name,
      accessToken: accessToken,
      refreshToken: accessToken,
      expiresIn: dayjs().add(59, 'days').unix() - dayjs().unix(),
      picture: location.picture || '',
      username: location.name,
    };
  }

  /**
   * Get all business locations
   */
  async getLocations(_: Record<string, unknown>, accessToken: string): Promise<Record<string, unknown>[]> {
    // First get accounts
    const accountsResponse = await this.fetch(
      `${this.ACCOUNT_MANAGEMENT_API_BASE}/accounts`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      'get accounts'
    );

    const accountsData = await accountsResponse.json();
    const accounts = accountsData.accounts || [];

    // Get locations for each account
    const allLocations = [];
    for (const account of accounts) {
      const locationsResponse = await this.fetch(
        `${this.BUSINESS_INFO_API_BASE}/${account.name}/locations?readMask=name,title,storefrontAddress,phoneNumbers,categories,websiteUri,regularHours,profile,metadata`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        'get locations'
      );

      const locationsData = await locationsResponse.json();
      const locations = locationsData.locations || [];

      // Format locations with detailed information
      for (const location of locations) {
        const formattedLocation = {
          id: location.name,
          name: location.title || location.name,
          picture: await this._getLocationPhoto(location.name, accessToken),
          accountName: account.accountName,
          location: this._formatAddress(location.storefrontAddress),
          phone: location.phoneNumbers?.primaryPhone || '',
          category: location.categories?.primaryCategory?.displayName || '',
          website: location.websiteUri || '',
          description: location.profile?.description || '',
          mapsUrl: location.metadata?.mapsUri || '',
          username: location.title || '',
        };
        allLocations.push(formattedLocation);
      }
    }

    return allLocations;
  }

  /**
   * Get a single location's detailed information
   */
  async getLocation(locationId: string, accessToken: string): Promise<Record<string, unknown>> {
    const response = await this.fetch(
      `${this.BUSINESS_INFO_API_BASE}/${locationId}?readMask=name,title,storefrontAddress,phoneNumbers,categories,websiteUri,regularHours,profile,metadata`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      'get location'
    );

    const location = await response.json();
    const picture = await this._getLocationPhoto(locationId, accessToken);

    return {
      id: location.name,
      name: location.title || location.name,
      picture: picture,
      location: this._formatAddress(location.storefrontAddress),
      phone: location.phoneNumbers?.primaryPhone || '',
      category: location.categories?.primaryCategory?.displayName || '',
      website: location.websiteUri || '',
      description: location.profile?.description || '',
      mapsUrl: location.metadata?.mapsUri || '',
      hours: location.regularHours || {},
    };
  }

  /**
   * Get location photo URL
   */
  private async _getLocationPhoto(locationName: string, accessToken: string): Promise<string> {
    try {
      const response = await this.fetch(
        `${this.BUSINESS_INFO_API_BASE}/${locationName}/media?pageSize=1`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        'get location photo'
      );

      const data = await response.json();
      const photoUrl = data.mediaItems?.[0]?.googleUrl;
      if (photoUrl) {
        return await fetchedImageBase64(photoUrl);
      }
      return '';
    } catch (error: unknown) {
      return '';
    }
  }

  /**
   * Format address object to string
   */
  private _formatAddress(address?: { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string }): string {
    if (!address) return '';
    const parts = [
      ...(address.addressLines || []),
      address.locality,
      address.administrativeArea,
      address.postalCode,
    ].filter(Boolean);
    return parts.join(', ');
  }

  /**
   * Create a post (local post) for a location
   */
  async createPost(
    locationId: string,
    postData: GMBPostData,
    accessToken: string
  ): Promise<Record<string, unknown>> {
    const response = await this.fetch(
      `${this.BUSINESS_INFO_API_BASE}/${locationId}/localPosts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      },
      'create post'
    );

    return response.json();
  }

  /**
   * Get analytics for a location using Business Profile Performance API
   */
  async getAnalytics(
    locationId: string,
    accessToken: string,
    days: number = 30
  ): Promise<AnalyticsData[]> {
    const endDate = dayjs();
    const startDate = dayjs().subtract(days, 'day');

    try {
      const response = await this.fetch(
        `${this.PERFORMANCE_API_BASE}/${locationId}/searchkeywords/impressions/monthly?` +
        `dailyRange.startDate.year=${startDate.year()}` +
        `&dailyRange.startDate.month=${startDate.month() + 1}` +
        `&dailyRange.startDate.day=${startDate.date()}` +
        `&dailyRange.endDate.year=${endDate.year()}` +
        `&dailyRange.endDate.month=${endDate.month() + 1}` +
        `&dailyRange.endDate.day=${endDate.date()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        'get analytics'
      );

      const data = await response.json();

      // Format analytics data
      const analyticsData: AnalyticsData[] = [
        {
          label: 'Search Impressions',
          percentageChange: 0,
            data: data.searchKeywordsCounts?.map((item: Record<string, unknown>) => ({
            total: item.insightsValue?.value || 0,
            date: `${item.date?.year}-${String(item.date?.month).padStart(2, '0')}-${String(item.date?.day).padStart(2, '0')}`,
          })) || [],
        },
      ];

      return analyticsData;
    } catch (error: unknown) {
      console.error('Analytics error:', error);
      return [];
    }
  }

  /**
   * Get all reviews for a location
   */
  async getReviews(
    locationId: string,
    accessToken: string,
    options?: { pageSize?: number; pageToken?: string }
  ): Promise<{ reviews: GMBReview[]; nextPageToken?: string }> {
    const params = new URLSearchParams({
      pageSize: String(options?.pageSize || 50),
      ...(options?.pageToken ? { pageToken: options.pageToken } : {}),
    });

    const response = await this.fetch(
      `${this.BUSINESS_INFO_API_BASE}/${locationId}/reviews?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      'get reviews'
    );

    const data = await response.json();

    return {
      reviews: data.reviews || [],
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Get latest reviews for a location
   */
  async getLatestReviews(
    locationId: string,
    accessToken: string,
    limit: number = 10
  ): Promise<GMBReview[]> {
    const { reviews } = await this.getReviews(locationId, accessToken, { pageSize: limit });
    return reviews;
  }

  /**
   * Reply to a review
   */
  async replyToReview(
    reviewName: string,
    replyText: string,
    accessToken: string
  ): Promise<Record<string, unknown>> {
    const response = await this.fetch(
      `${this.BUSINESS_INFO_API_BASE}/${reviewName}/reply`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: replyText,
        }),
      },
      'reply to review'
    );

    return response.json();
  }

  /**
   * Delete a review reply
   */
  async deleteReviewReply(reviewName: string, accessToken: string): Promise<void> {
    await this.fetch(
      `${this.BUSINESS_INFO_API_BASE}/${reviewName}/reply`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      'delete review reply'
    );
  }

  /**
   * Validate post content
   */
  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];

    if (post.content && post.content.length > 1500) {
      errors.push('Post content is too long (max 1500 characters)');
    }

    return errors;
  }

  /**
   * Publish a post to Google My Business
   */
  override async post(
    postDetails: PostWithAllData,
    comments: PostWithAllData[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content, settings } = this.getPlatformData(postDetails);

      // Prepare post data based on type
      const postData: GMBPostData = {
        topicType: settings?.topicType || 'STANDARD',
        summary: content || '',
        media: postDetails.assets?.map((asset: Asset) => ({
          mediaFormat: asset.mimeType.includes('video') ? 'VIDEO' as const : 'PHOTO' as const,
          sourceUrl: getPublicUrlForAsset(asset.url),
        })),
      };

      // Handle Event
      if (postData.topicType === 'EVENT' && settings) {
        if (!settings.eventTitle || !settings.eventStartDate) {
          throw new Error('Event title and start date are required for EVENT posts');
        }

        const start = dayjs(`${settings.eventStartDate} ${settings.eventStartTime || '00:00'}`);
        const end = settings.eventEndDate
          ? dayjs(`${settings.eventEndDate} ${settings.eventEndTime || '23:59'}`)
          : start.add(1, 'hour');

        postData.event = {
          title: settings.eventTitle,
          schedule: {
            startDate: { year: start.year(), month: start.month() + 1, day: start.date() },
            startTime: { hours: start.hour(), minutes: start.minute() },
            endDate: { year: end.year(), month: end.month() + 1, day: end.date() },
            endTime: { hours: end.hour(), minutes: end.minute() },
          }
        };
      }

      // Handle Offer
      if (postData.topicType === 'OFFER' && settings) {
        if (!settings.offerCouponCode) {
          throw new Error('Coupon code is required for OFFER posts');
        }

        postData.offer = {
          couponCode: settings.offerCouponCode,
          redeemOnlineUrl: settings.offerRedeemUrl,
          termsConditions: settings.offerTerms,
        };
      }

      // Handle CTA
      if (settings?.callToActionType && settings.callToActionType !== 'CALL') {
        if (!settings.callToActionUrl) {
          throw new Error('CTA URL is required for the selected action type');
        }
        postData.callToAction = {
          actionType: settings.callToActionType,
          url: settings.callToActionUrl,
        };
      } else if (settings?.callToActionType === 'CALL') {
        postData.callToAction = {
          actionType: 'CALL',
        };
      }

      const result = await this.createPost(
        socialMediaAccount.accountId,
        postData,
        socialMediaAccount.accessToken
      );

      const response: PostResponse = {
        id: postDetails.id,
        postId: result.name || '',
        releaseURL: result.searchUrl || '',
        status: 'published',
      };

      this.emit('googlemybusiness:post:published', { postId: result.name, response });
      return response;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('googlemybusiness:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  /**
   * Update a post (GMB doesn't support updating posts, so we'll return an error)
   */
  override async update(
    postDetails: PostWithAllData,
    comments: PostWithAllData[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    return {
      id: postDetails.id,
      postId: '',
      releaseURL: '',
      status: 'failed',
      error: 'Google My Business does not support updating posts',
    };
  }

  /**
   * Add comment (GMB doesn't support comments on posts, only review replies)
   */
  override async addComment(
    postDetails: PostWithAllData,
    commentDetails: PostWithAllData,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    return {
      id: commentDetails.id,
      postId: '',
      releaseURL: '',
      status: 'failed',
      error: 'Google My Business does not support comments on posts',
    };
  }

  /**
   * Get comments for a Google My Business post
   * Note: GMB does not support comments API
   */
  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    return Promise.resolve({
      platform: this.pluginName,
      postId: '',
      comments: [],
      hasMore: false,
    });
  }

  /**
   * Reply to a comment on Google My Business
   * Note: GMB does not support comments API
   */
  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    return {
      success: false,
      error: 'Google My Business does not support comments API',
    };
  }
}
