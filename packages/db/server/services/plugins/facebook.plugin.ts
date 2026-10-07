import { parseJsonObject, toJsonString } from '#layers/BaseShared/utils/json';
import type { Asset, PostWithAllData, SocialMediaAccount, PlatformContentOverride } from '#layers/BaseDB/db/schema';
import type { PostResponse, GetCommentsResponse, ReplyCommentResponse, PlatformComment, PluginPostDetails, PluginSocialMediaAccount, PostInsight, PlatformStats, PlatformConversation, GetConversationsResponse } from '#layers/BaseDB/server/services/SchedulerPost.service';
import type { FacebookSettings } from '#layers/BaseShared/shared/platformSettings';
import dayjs from 'dayjs';
import { BaseSchedulerPlugin, createPostInsightsFallback, extractExternalPostId } from '#layers/BaseDB/server/services/SchedulerPost.service';
import type { FacebookPage } from '#layers/BaseShared/server/types/facebook-pages';
import {
  collectFacebookPostInsights,
  type FacebookInsightMetric,
  type FacebookInsightsQuery,
} from './facebook-insights';

type FacebookApiInsightValue = { value: number; end_time: string };
type FacebookApiInsight = { name: string; values?: FacebookApiInsightValue[] };
type FacebookApiMetric = { name: string; values?: { value: number }[] };
type FacebookApiPostInsightMetric = FacebookInsightMetric;
type FacebookApiReactionType = { like?: number; love?: number; haha?: number; wow?: number; sorry?: number; anger?: number;[key: string]: number | undefined };
type FacebookApiComment = {
  id: string;
  message?: string;
  from?: { name?: string; id?: string; picture?: { data?: { url?: string } } };
  created_time?: string;
  like_count?: number;
  comment_count?: number;
  parent?: { id?: string };
};

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

type FacebookDto = {
  url?: string;
};

/** Post-object engagement totals (`/{post}?fields=...`). */
type FacebookPostTotals = {
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
  error?: Record<string, unknown>;
};

export class FacebookPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'facebook';
  readonly pluginName = 'facebook';

  private normalizeContent(content: string): string {
    if (!content) return '';
    return content
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }

  private getPlatformData(postDetails: PostWithAllData, platformPost?: Record<string, unknown>) {
    const platformName = this.pluginName;
    const platformContent = (postDetails.platformContent as Record<string, PlatformContentOverride | undefined>)?.[platformName];
    const platformSettings = (postDetails.platformSettings as Record<string, unknown>)?.[platformName] as FacebookSettings | undefined;
    const rawContent = platformContent?.content || postDetails.content;
    const postFormat = postDetails.postFormat ?? 'post';
    const comments = platformContent?.comments || [];

    return {
      content: this.normalizeContent(rawContent),
      settings: platformSettings,
      postFormat: postFormat,
      comments
    };
  }

  // NOTE: standard interface methods (getComments, replyToComment,
  // deleteComment, hideComment, getConversations, replyToConversation,
  // getPostInsights) must NOT be listed here. SchedulerPost.use() binds
  // exposed methods with a prepended args array, which would shadow the
  // prototype delegators and shift every argument by one — the plugin then
  // receives [args] as socialMediaAccount (accountId/accessToken undefined
  // → Meta "Cannot parse access token"). Only Facebook-specific helpers
  // without a prototype equivalent belong below.
  public override exposedMethods = [
    'handleErrors',
    'reConnect',
    'pages',
    'fetchPageInformation',
    'analytics',
    'getPageInsights',
    'getLatestComments',
    'getCommentCount',
    'updateComment',
    'addCommentToPost',
    'getTaggedPosts',
    'getMentions',
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

  private readonly API_VERSION = 'v25.0';
  private readonly GRAPH_API_BASE_URL = 'https://graph.facebook.com';
  private readonly OAUTH_DIALOG_URL = 'https://www.facebook.com/v20.0/dialog/oauth';
  private readonly baseUrl = process.env.NUXT_BASE_URL || 'http://localhost:3000'

  protected init(_options?: Record<string, unknown>): void {
    // No logging here: plugin init runs on every scheduler boot and the
    // options object is noise in production logs.
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
   * Exchange any valid user token for a 60-day long-lived one.
   */
  async exchangeLongLivedUserToken(
    userAccessToken: string
  ): Promise<{ userToken: string }> {
    const appId = process.env.NUXT_FACEBOOK_CLIENT_ID;
    const appSecret = process.env.NUXT_FACEBOOK_CLIENT_SECRET;
    if (!appId || !appSecret) {
      throw new Error('Facebook app credentials are not configured');
    }
    const exchangeUrl = `${this.GRAPH_API_BASE_URL}/${this.API_VERSION}/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: userAccessToken,
    });
    const exchangeRes = await fetch(exchangeUrl);
    if (!exchangeRes.ok) {
      throw new Error(`Facebook token exchange failed: ${await exchangeRes.text()}`);
    }
    const { access_token: longLivedToken } = await exchangeRes.json() as { access_token?: string };
    if (!longLivedToken) {
      throw new Error('Facebook token exchange returned no token');
    }
    return { userToken: longLivedToken };
  }

  /**
   * Renew a page access token without user interaction.
   * Exchange: user token → 60-day long-lived user token → non-expiring
   * page token. Throws with Meta's message when the user token itself is
   * dead (revoked/expired) — then only a manual reconnect helps.
   */
  async refreshPageToken(
    pageId: string,
    userAccessToken: string
  ): Promise<{ pageAccessToken: string }> {
    const { userToken: longLivedToken } = await this.exchangeLongLivedUserToken(userAccessToken);
    const pageRes = await this.fetch(
      this._getGraphApiUrl(`/${pageId}?fields=access_token&access_token=${longLivedToken}`),
      undefined,
      'refresh page token'
    );
    const { access_token: pageAccessToken } = await pageRes.json() as { access_token?: string };
    if (!pageAccessToken) {
      throw new Error('Facebook page token fetch returned no token');
    }
    return { pageAccessToken };
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
    // SAFE: audit rows are readable via admin API — never persist access_token.
    const safeUrl = url.replace(/access_token=[^&]*/g, 'access_token=***')
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorBody = await response.text();
        log.error({ content: `Facebook API Error (${context})`, status: response.status, errorBody });
        await this.logPluginEvent('fetch-error:response', 'failure', `Error: ${errorBody}, Context: ${context}`, safeUrl);
        throw new Error(`Facebook API Error (${context}): ${errorBody}`);
      }
      return response;
    } catch (error) {
      log.error({ content: `Network or Fetch Error (${context})`, error: (error as Error).message });
      await this.logPluginEvent('fetch-error', 'failure', `Error: ${(error as Error).message}, Context: ${context}`, safeUrl);
      throw error;
    }
  }

  /**
   * Post-object totals with the same ladder philosophy as facebook-insights.ts:
   * field validity varies by object type (a Page id has no `reactions`, some
   * objects reject edge modifiers), and one bad field fails the whole call
   * with (#100). Drops the offending field and retries so surviving totals
   * still come back instead of a blanket error.
   */
  private async fetchPostTotals(
    externalPostId: string,
    accessToken: string,
  ): Promise<FacebookPostTotals> {
    // NOTE: no inline insights.* fragment here — edge modifiers like
    // insights.metric(...).period(...) are not valid post-object fields
    // (Graph #2500 syntax error). Insights come from the /insights calls.
    // `shares` is likewise a plain field returning `{count}` — requesting
    // `shares.count` fails with `Syntax error "Expected \"(\""` (#2500).
    const remaining = ['reactions.summary(total_count)', 'comments.summary(total_count)', 'shares']
    let lastError: Record<string, unknown> = { message: 'Post totals unavailable' }
    while (remaining.length > 0) {
      let body: FacebookPostTotals
      try {
        const res = await fetch(this._getGraphApiUrl(
          `/${externalPostId}?fields=${remaining.join(',')}&access_token=${accessToken}`
        ))
        body = await res.json() as FacebookPostTotals
      } catch {
        return { error: { message: 'Network error fetching post totals' } }
      }
      if (!body.error) return body
      lastError = body.error
      const missing = /nonexisting field \((\w+)\)/.exec(JSON.stringify(body.error))?.[1]
      const idx = missing ? remaining.findIndex(field => field === missing || field.startsWith(`${missing}.`)) : -1
      if (idx === -1) return { error: lastError }
      log.warn({ content: '[Facebook] Post totals field unsupported, retrying without it', field: missing })
      remaining.splice(idx, 1)
    }
    return { error: lastError }
  }

  /**
   * Optional insights batch. Uses raw fetch so an invalid-metric 400 (#100)
   * never logs a plugin failure — the fallback ladder decides what to do next.
   */
  private async tryPostInsights(
    externalPostId: string,
    accessToken: string,
    query: FacebookInsightsQuery,
  ): Promise<FacebookApiPostInsightMetric[]> {
    const metricType = query.metricType ? `&metric_type=${query.metricType}` : '';
    const url = this._getGraphApiUrl(
      `/${externalPostId}/insights?metric=${query.metrics}${metricType}&access_token=${accessToken}`
    );
    try {
      const response = await fetch(url);
      if (!response.ok) return [];
      const json = await response.json() as { data?: FacebookApiPostInsightMetric[] };
      return json.data ?? [];
    } catch {
      return [];
    }
  }

  handleErrors(body: string):
    | {
      type: 'refresh-token' | 'bad-body';
      value: string;
    }
    | undefined {
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
  ): Promise<Array<{ label: string; data: Array<{ total: number; date: string }> }>> {
    const until = dayjs().endOf('day').unix();
    const since = dayjs().subtract(days, 'day').unix();

    const url = this._getGraphApiUrl(
      `/${pageId}/insights?metric=page_views_total,page_post_engagements,page_follows&period=day&since=${since}&until=${until}&access_token=${accessToken}`
    );
    const response = await this.fetch(url, undefined, 'fetch page insights')
    const { data, error } = await response.json() as { data?: FacebookApiInsight[]; error?: Record<string, unknown> };

    if (error) {
      log.warn({ content: '[Facebook] Page insights error', error })
      return []
    }

    const labelMap: Record<string, string> = {
      page_views_total: 'Reach',
      page_post_engagements: 'Post Engagements',
      page_follows: 'Followers',
    }

    return data?.map((d: FacebookApiInsight) => ({
      label: labelMap[d.name] || d.name,
      data: d?.values?.map((v: FacebookApiInsightValue) => ({
        total: v.value,
        date: dayjs(v.end_time).format('YYYY-MM-DD'),
      })) || [],
    })) || [];
  }

  async getPostInsights(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostInsight[]> {
    const externalPostId = this.extractExternalPostId(postDetails, socialMediaAccount);
    if (!externalPostId) {
      return createPostInsightsFallback(this.pluginName);
    }

    const accessToken = socialMediaAccount.accessToken;

    // Insights and post totals are fetched in parallel; both walk a fallback
    // ladder (insights: facebook-insights.ts, totals: fetchPostTotals) because
    // one invalid metric/field fails the whole Graph batch with (#100) and
    // validity varies by post type and API version.
    const [insightsData, postRes] = await Promise.all([
      collectFacebookPostInsights(query => this.tryPostInsights(externalPostId, accessToken, query)),
      this.fetchPostTotals(externalPostId, accessToken),
    ])

    // Only fall back when there is nothing at all to show.
    if (insightsData.length === 0 && postRes.error) {
      log.warn({ content: '[Facebook] Post insights error - both queries failed', error: postRes.error })
      return createPostInsightsFallback(this.pluginName);
    }
    if (insightsData.length === 0) {
      log.warn({ content: '[Facebook] Post insights unavailable for this post type, using post object totals' })
    }
    if (postRes.error) {
      log.warn({ content: '[Facebook] Post object error', error: postRes.error })
    }

    const metricValue = (name: string): number => {
      const metric = insightsData.find((d) => d.name === name);
      const value = metric?.values?.[0]?.value;
      return typeof value === 'number' ? value : 0;
    };

    const reactionsByType = insightsData.find((d) => d.name === 'post_reactions_by_type_total');
    const reactionValue = reactionsByType?.values?.[0]?.value;
    const reactionsFromInsights: number = reactionValue && typeof reactionValue === 'object'
      ? Object.values(reactionValue as FacebookApiReactionType).reduce<number>((sum, count) => sum + (Number(count) || 0), 0)
      : 0;

    const totalReactions: number = postRes.reactions?.summary?.total_count ?? reactionsFromInsights;
    const totalComments: number = postRes.comments?.summary?.total_count ?? 0;
    const totalShares: number = postRes.shares?.count ?? 0;
    const totalEngagement: number = totalReactions + totalComments + totalShares;

    const viewsValue = metricValue('post_total_media_view_unique') || metricValue('post_media_view') || 0
    const impressionsValue = metricValue('post_media_view') || 0

    const insights: PostInsight[] = [
      { label: 'Views', value: viewsValue },
      { label: 'Impressions', value: impressionsValue },
      { label: 'Engagement', value: totalEngagement },
      { label: 'Reactions', value: totalReactions },
      { label: 'Comments', value: totalComments },
      { label: 'Shares', value: totalShares },
      { label: 'Link Clicks', value: metricValue('post_clicks') },
      { label: 'Engaged Users', value: metricValue('post_engaged_users') },
      { label: 'Video Views', value: metricValue('post_media_view') || 0 },
    ];

    const reactionLabelMap: Record<string, string> = {
      like: 'Likes',
      love: 'Love',
      haha: 'Haha',
      wow: 'Wow',
      sorry: 'Sorry',
      anger: 'Angry',
    };
    const reactionBreakdown = reactionValue && typeof reactionValue === 'object'
      ? (reactionValue as FacebookApiReactionType)
      : undefined;
    if (reactionBreakdown) {
      for (const [type, count] of Object.entries(reactionBreakdown)) {
        if (count) {
          insights.push({ label: reactionLabelMap[type] || type, value: count });
        }
      }
    }

    return insights;
  }

  /**
   * Get comments on a post or page object (raw API call)
   */
  async getCommentsRaw(
    objectId: string,
    accessToken: string,
    options?: { limit?: number; after?: string }
  ): Promise<{ data?: FacebookApiComment[]; paging?: { cursors?: { after?: string; before?: string } }; error?: { message: string } }> {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,message,from,created_time,like_count,comment_count,parent',
      limit: String(options?.limit || 25),
      ...(options?.after ? { after: options.after } : {}),
    });

    const url = this._getGraphApiUrl(`/${objectId}/comments?${params.toString()}`);
    const response = await this.fetch(url, undefined, 'get comments');
    return response.json() as Promise<{ data?: FacebookApiComment[]; paging?: { cursors?: { after?: string; before?: string } }; error?: { message: string } }>;
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
   * Reply to a comment (raw API call)
   */
  async replyToCommentRaw(
    commentId: string,
    replyText: string,
    accessToken: string
  ): Promise<{ id?: string; error?: { message: string } }> {
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
    return response.json() as Promise<{ id?: string; error?: { message: string } }>;
  }

  /**
   * Extract external post ID from postDetails
   */
  private extractExternalPostId(postDetails: PluginPostDetails, socialMediaAccount: PluginSocialMediaAccount): string | null {
    return extractExternalPostId(postDetails, socialMediaAccount);
  }

  /**
   * Transform Facebook API comment to PlatformComment format
   */
  private transformComment(fbComment: FacebookApiComment): PlatformComment {
    return {
      id: fbComment.id,
      text: fbComment.message || '',
      authorName: fbComment.from?.name || 'Unknown',
      authorId: fbComment.from?.id,
      authorPicture: fbComment.from?.picture?.data?.url,
      createdAt: fbComment.created_time,
      likeCount: fbComment.like_count,
      replyCount: fbComment.comment_count,
      parentId: fbComment.parent?.id,
    };
  }

  /**
   * Get comments - implements BaseSchedulerPlugin interface
   */
  override async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    const externalPostId = this.extractExternalPostId(postDetails, socialMediaAccount);

    if (!externalPostId) {
      return {
        platform: this.pluginName,
        postId: postDetails.id,
        comments: [],
        hasMore: false,
      };
    }

    const accessToken = socialMediaAccount.accessToken;

    try {
      const result = await this.getCommentsRaw(externalPostId, accessToken, {
        limit: options?.limit,
        after: options?.cursor,
      });

      const comments: PlatformComment[] = (result.data || []).map((c: FacebookApiComment) =>
        this.transformComment(c)
      );

      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments,
        hasMore: !!result.paging?.cursors?.after,
        nextCursor: result.paging?.cursors?.after,
      };
    } catch (error) {
      log.error({ content: 'Error fetching Facebook comments', plugin: 'facebook', error: (error as Error).message });
      this.logPluginEvent('get-comments', 'failure', `Error: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Reply to comment - implements BaseSchedulerPlugin interface
   */
  override async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    const accessToken = socialMediaAccount.accessToken;

    try {
      const result = await this.replyToCommentRaw(commentId, replyText, accessToken);

      if (result.error) {
        return {
          success: false,
          error: result.error.message || 'Failed to reply to comment',
        };
      }

      return {
        success: true,
        comment: this.transformComment(result),
      };
    } catch (error) {
      log.error({ content: 'Error replying to Facebook comment', plugin: 'facebook', error: (error as Error).message });
      this.logPluginEvent('reply-comment-error', 'failure', `Error: ${(error as Error).message}`, commentId);
      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to comment',
      };
    }
  }

  /**
   * Get page conversations (DMs) - implements BaseSchedulerPlugin interface.
   * Note: Meta enforces a 24h customer-service window for replies — the API
   * rejects messages outside it; the error is surfaced, never swallowed.
   */
  override async getConversations(
    extra,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetConversationsResponse> {
    log.info({ content: 'Fetching Facebook conversations', plugin: 'facebook', });
    const pageId = socialMediaAccount.accountId;
    const accessToken = socialMediaAccount.accessToken;

    try {
      const result = await this.getConversationsRaw(pageId, accessToken, {
        limit: options?.limit,
        after: options?.cursor,
      });

      const conversations: PlatformConversation[] = (result.data || []).map((c) => {
        const convo = c as {
          id: string;
          message_count?: number;
          unread_count?: number;
          updated_time?: string;
          participants?: { data?: { id?: string; name?: string }[] };
          snippet?: string;
        };
        return {
          id: convo.id,
          platform: this.pluginName,
          accountId: socialMediaAccount.id,
          participants: (convo.participants?.data || []).map(p => ({ id: p.id, name: p.name })),
          messageCount: convo.message_count,
          unreadCount: convo.unread_count,
          updatedTime: convo.updated_time,
          snippet: convo.snippet,
        };
      });

      return {
        platform: this.pluginName,
        accountId: socialMediaAccount.id,
        conversations,
        hasMore: !!(result.paging as { cursors?: { after?: string } } | undefined)?.cursors?.after,
        nextCursor: (result.paging as { cursors?: { after?: string } } | undefined)?.cursors?.after,
      };
    } catch (error) {
      log.error({ content: 'Error fetching Facebook conversations', plugin: 'facebook', error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Reply to a conversation (DM) - implements BaseSchedulerPlugin interface
   */
  override async replyToConversation(
    socialMediaAccount: PluginSocialMediaAccount,
    conversationId: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const result = await this.replyToConversationRaw(conversationId, message, socialMediaAccount.accessToken);

      if (result.error) {
        return {
          success: false,
          error: result.error.message || 'Failed to reply to conversation',
        };
      }

      return { success: true, messageId: result.id };
    } catch (error) {
      log.error({ content: 'Error replying to Facebook conversation', plugin: 'facebook', error: (error as Error).message });
      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to conversation',
      };
    }
  }

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
  ): Promise<{ data?: Array<Record<string, unknown>>; paging?: Record<string, unknown> }> {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,message,created_time,from,permalink_url',
      limit: String(options?.limit || 25),
      ...(options?.after ? { after: options.after } : {}),
    });

    const url = this._getGraphApiUrl(`/${pageId}/tagged?${params.toString()}`);
    const response = await this.fetch(url, undefined, 'get tagged posts');
    return response.json() as Promise<{ data?: Array<Record<string, unknown>>; paging?: Record<string, unknown> }>;
  }

  /**
   * Get mentions of the page (same as tagged for now)
   */
  async getMentions(
    pageId: string,
    accessToken: string,
    options?: { limit?: number; after?: string }
  ): Promise<{ data?: Array<Record<string, unknown>>; paging?: Record<string, unknown> }> {
    return this.getTaggedPosts(pageId, accessToken, options);
  }

  /**
   * Get page conversations/messages
   */
  async getConversationsRaw(
    pageId: string,
    accessToken: string,
    options?: { limit?: number; after?: string }
  ): Promise<{ data?: Array<Record<string, unknown>>; paging?: Record<string, unknown> }> {
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,link,updated_time,message_count,unread_count,participants',
      limit: String(options?.limit || 25),
      ...(options?.after ? { after: options.after } : {}),
    });

    const url = this._getGraphApiUrl(`/${pageId}/conversations?${params.toString()}`);
    const response = await this.fetch(url, undefined, 'get conversations');
    return response.json() as Promise<{ data?: Array<Record<string, unknown>>; paging?: Record<string, unknown> }>;
  }

  /**
   * Reply to a conversation
   */
  async replyToConversationRaw(
    conversationId: string,
    message: string,
    accessToken: string
  ): Promise<{ id?: string; error?: { message: string } }> {
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
    return response.json() as Promise<{ id?: string; error?: { message: string } }>;
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

  async pages(_: unknown, accessToken: string): Promise<FacebookPage[]> {
    const url = this._getGraphApiUrl(`/me/accounts?fields=id,instagram_business_account,username,name,picture.type(large)&access_token=${accessToken}`);
    const { data }: { data: FacebookPage[] } = await (
      await this.fetch(url, undefined, 'fetch pages')
    ).json();
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
      `/${id}/insights?metric=page_views_total,page_post_engagements,page_follows&period=day&since=${since}&until=${until}&access_token=${accessToken}`
    );
    const { data } = await (
      await this.fetch(url, undefined, 'fetch analytics')
    ).json();

    const labelMap: Record<string, string> = {
      page_views_total: 'Reach',
      page_post_engagements: 'Post Engagements',
      page_follows: 'Followers',
    }

    return (
      data?.map((d: FacebookApiInsight) => ({
        label: labelMap[d.name] || d.name,
        percentageChange: 5,
        data: d?.values?.map((v: FacebookApiInsightValue) => ({
          total: v.value,
          date: dayjs(v.end_time).format('YYYY-MM-DD'),
        })) || [],
      })) || []
    );
  }

  override async validate(post: PluginPostDetails): Promise<string[]> {

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
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content, settings, postFormat, comments: postComments } = this.getPlatformData(postDetails);

      let finalId = '';
      let finalUrl = '';

      const videoAsset = postDetails.assets?.find(media =>
        media.mimeType.includes('video') || media.filename.includes('.mp4')
      );
      const photoAssets = postDetails.assets?.filter(media =>
        media.mimeType.includes('image') ||
        media.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );

      const effectiveFormat = postFormat || (videoAsset ? 'video' : 'post');

      switch (effectiveFormat) {
        case 'reel': {
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
            const uploadPhotos = photoAssets?.length
              ? await this._uploadPhotos(
                socialMediaAccount.accountId,
                socialMediaAccount.accessToken,
                photoAssets,
                socialMediaAccount.userId
              )
              : [];

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
      if (postComments?.length) {
        await Promise.all(
          postComments.map(async (comment: string) => {
            await this.addCommentToPost(finalId, comment, socialMediaAccount.accessToken);
          })
        );
      }

      const response: PostResponse = {
        id: postDetails.id,
        postId: finalId,
        releaseURL: finalUrl,
        status: 'published',
      };

      this.emit('facebook:post:published', { postId: finalId, response, format: effectiveFormat });
      return response;
    } catch (error: unknown) {
      log.error({ content: 'Facebook post failed', plugin: 'facebook', error: (error as Error).message });
      this.logPluginEvent('post-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id);
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
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    const publicationDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
    if (!publicationDetails) {
      throw new Error('Published platform details not found');
    }
    const details = parseJsonObject(toJsonString(publicationDetails.publishDetail)) as PostResponse;
    const postId = details.postId;
    if (!postId) {
      throw new Error('Post details not found');
    }

    const { content, settings } = this.getPlatformData(postDetails);

    const url = this._getGraphApiUrl(`/${postId}?access_token=${socialMediaAccount.accessToken}`);

    const body: Record<string, string> = { message: content };
    if (settings?.url) {
    }

    const requestApi = await this.fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      'update post'
    );

    const responseJson = await requestApi.json();

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
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    const pageId = socialMediaAccount.accountId
    const token = socialMediaAccount.accessToken

    // Fetch profile with modern fields (fan_count deprecated -> followers_count is source of truth)
    // and insights with fallback for pages below 100 likes (insights empty)
    const [profileData, insightsData, feedData] = await Promise.all([
      this.fetch(
        this._getGraphApiUrl(`/${pageId}?fields=id,name,picture.type(large),fan_count,followers_count,posts.limit(0).summary(true)&access_token=${token}`),
        undefined,
        'fetch page profile'
      )
        .then(r => r.json())
        .catch(() => ({ id: pageId, name: socialMediaAccount.accountName })),
      this.getPageInsights(pageId, token, 30).catch(() => []),
      this.fetch(
        this._getGraphApiUrl(`/${pageId}/feed?fields=id&limit=1&summary=false&access_token=${token}`),
        undefined,
        'fetch page feed'
      )
        .then(r => r.json())
        .then((j: any) => j.summary?.total_count ?? j.data?.length ?? undefined)
        .catch(() => undefined),
    ])

    const followersCount = profileData.followers_count ?? profileData.fan_count ?? 0
    const postsCount = typeof feedData === 'number' ? feedData : profileData.posts?.summary?.total_count ?? undefined

    let totalEngagement = 0
    let totalViews = 0
    let insightsFollowersCurrent = 0
    let insightsFollowersPrevious = 0
    let hasInsights = false

    for (const metric of insightsData) {
      if (metric.label === 'Post Engagements') {
        hasInsights = true
        // @ts-ignore
        totalEngagement += metric.data?.reduce((sum: number, d: any) => sum + (d.total || 0), 0) || 0
      }
      if (metric.label === 'Reach' || metric.label === 'Views') {
        hasInsights = true
        // @ts-ignore
        totalViews += metric.data?.reduce((sum: number, d: any) => sum + (d.total || 0), 0) || 0
      }
      if (metric.label === 'Followers' && metric.data?.length) {
        hasInsights = true
        if (metric.data.length >= 2) {
          insightsFollowersPrevious = metric.data[0]?.total || 0
          insightsFollowersCurrent = metric.data[metric.data.length - 1]?.total || 0
        } else {
          insightsFollowersCurrent = metric.data[metric.data.length - 1]?.total || 0
        }
      }
    }

    // Prefer profile followers_count as source of truth (JS), insights for growth
    // For pages below 100 likes insights returns empty -> use profile count
    const currentFollowers = hasInsights && insightsFollowersCurrent ? insightsFollowersCurrent : followersCount
    const previousFollowers = insightsFollowersPrevious || (hasInsights ? currentFollowers : 0)
    const followerAbsolute = hasInsights ? currentFollowers - previousFollowers : 0
    const followerPercentage = previousFollowers > 0
      ? Math.round((followerAbsolute / previousFollowers) * 10000) / 100
      : 0

    // Views fallback: if insights empty, views = 0 (will be populated once page passes threshold)
    const totalReach = totalViews

    const base64Picture = profileData.picture?.data?.url
      ? await fetchedImageBase64(profileData.picture.data.url)
      : undefined

    // Growth for engagement/views
    const engagementGrowth = hasInsights && totalEngagement > 0 ? { absolute: totalEngagement, percentage: 0 } : undefined

    return {
      platform: 'facebook',
      accountId: pageId,
      username: profileData.name || socialMediaAccount.accountName || '',
      picture: base64Picture,
      fetchedAt: new Date().toISOString(),
      followers: currentFollowers,
      posts: postsCount,
      engagement: {
        total: totalEngagement,
        views: totalViews,
        reach: totalReach,
      },
      growth: {
        followers: {
          absolute: followerAbsolute,
          percentage: followerPercentage,
        },
        ...(engagementGrowth ? { engagement: engagementGrowth } : {}),
      },
      extra: {
        name: profileData.name,
        fan_count: profileData.fan_count,
        followers_count: followersCount,
        hasInsights,
        insightsMetrics: insightsData.map(m => m.label),
      },
    }
  }

  override async addComment(
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
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
      log.error({ content: 'Facebook comment failed', plugin: 'facebook', error: (error as Error).message });
      this.logPluginEvent('comment-error', 'failure', `Error: ${(error as Error).message}`, commentDetails.id);
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
      formatting?: 'PLAINTEXT' | 'MARKDOWN';
    }
  ): Promise<{ id: string; success: boolean }> {
    const url = this._getGraphApiUrl(`/${postId}/comments?access_token=${accessToken}`);

    const body: { message: string; formatting?: string } = {
      message: message,
    };

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
      `/${pageId}/insights?metric=page_impressions_unique&access_token=${accessToken}&period=${period}&since=${since}&until=${until}`
    );
    const { data } = await (await this.fetch(url, undefined, 'get page impressions unique')).json();

    return data?.find((d: { period: string }) => d.period === period) || data?.[0] || {};
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
      formatting?: 'PLAINTEXT' | 'MARKDOWN';
    }
  }
  ): Promise<{ id: string; permalink_url: string }> {
    let link = options?.link;
    if (!link) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const match = message.match(urlRegex);
      if (match && match.length > 0) {
        link = match[0];
      }
    }

    const url = this._getGraphApiUrl(`/${pageId}/feed?access_token=${accessToken}&fields=id,permalink_url`);
    const body: Record<string, unknown> = {
      message: message,
      published: options?.published ?? true,
    };

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
      formatting?: 'PLAINTEXT' | 'MARKDOWN';
    }
  ): Promise<{ id: string }> {
    let link = options?.link;
    if (!link) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const match = message.match(urlRegex);
      if (match && match.length > 0) {
        link = match[0];
      }
    }

    const url = this._getGraphApiUrl(`/${groupId}/feed?access_token=${accessToken}`);
    const body: Record<string, unknown> = {
      message: message,
    };

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
    raw_data: Array<Record<string, unknown>>;
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
    const { data } = await (await this.fetch(url, undefined, 'get video insights')).json() as { data?: FacebookApiMetric[] };

    const result: Record<string, number> = {
    };
    data?.forEach((metric: FacebookApiMetric) => {
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
    raw_data: Array<Record<string, unknown>>;
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
    const { data } = await (await this.fetch(url, undefined, 'get reel insights')).json() as { data?: FacebookApiMetric[] };

    const result: Record<string, unknown> = {
    };
    data?.forEach((metric: FacebookApiMetric) => {
      result[metric.name] = metric.values?.[0]?.value;
    });

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
