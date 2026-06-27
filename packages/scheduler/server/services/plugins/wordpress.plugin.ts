import type { PostDetails, PostResponse, Integration, PluginSocialMediaAccount, PluginPostDetails, GetCommentsResponse, ReplyCommentResponse, PlatformComment, PlatformStats } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import type { WordPressSettings } from '../../../shared/platformSettings';

import { platformConfigurations } from '../../../shared/platformConstants';

export class WordPressPlugin extends BaseSchedulerPlugin {
  override async getStatistic(postDetails: PluginPostDetails, socialMediaAccount: PluginSocialMediaAccount): Promise<PlatformStats> {
    try {
      const accessToken = socialMediaAccount.accessToken;
      const siteUrl = socialMediaAccount.accountId || socialMediaAccount.accountName;

      if (!siteUrl) {
        log.error({ content: '[WordPress] No site URL found in account settings' });
        return this.createZeroStats(socialMediaAccount);
      }

      const wpcomSiteId = socialMediaAccount.metadata?.wpcomSiteId as string || siteUrl as string;
      const statsResponse = await fetch(
        `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(wpcomSiteId)}/stats`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!statsResponse.ok) {
        log.error(`[WordPress] Failed to fetch stats: ${await statsResponse.text()}`);
        return this.createZeroStats(socialMediaAccount);
      }

      const stats = await statsResponse.json() as Record<string, unknown>;

      let totalViewsMonth = 0
      let totalViewsWeek = 0
      let totalViewsDay = 0
      let totalLikes = 0
      let totalComments = 0
      let totalWords = 0
      let publishedCount = 0
      const topPosts: Array<{ id: number; title: string; url: string; views: number; likes: number; comments: number; date: string }> = []

      try {
        const [summaryResponse, postsResponse] = await Promise.all([
          fetch(
            `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(wpcomSiteId)}/stats/summary`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          ),
          fetch(
            `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(wpcomSiteId)}/posts?number=100&status=publish&fields=ID,title,URL,like_count,comment_count,date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          ),
        ])

        if (summaryResponse.ok) {
          const summary = await summaryResponse.json() as Record<string, unknown>
          const weeks = (summary.weeks as Array<Array<number>>) || []
          const days = (summary.days as Array<Array<number>>) || []

          for (const week of weeks.slice(-4)) {
            totalViewsMonth += week[1] || 0
          }
          for (const week of weeks.slice(-1)) {
            totalViewsWeek += week[1] || 0
          }
          for (const day of days.slice(-1)) {
            totalViewsDay += day[1] || 0
          }

          totalLikes = (summary.likes as number) || 0
          totalComments = (summary.comments as number) || 0
          totalWords = (summary.words as number) || 0
        }

        if (postsResponse.ok) {
          const postsData = await postsResponse.json() as Record<string, unknown>
          const posts = (postsData.posts as Array<Record<string, unknown>>) || []
          publishedCount = posts.length

          for (const post of posts) {
            const likeCount = (post.like_count as number) || 0
            const commentCount = (post.comment_count as number) || 0

            topPosts.push({
              id: post.ID as number,
              title: (post.title as string)?.substring(0, 200) || '',
              url: post.URL as string,
              views: 0,
              likes: likeCount,
              comments: commentCount,
              date: post.date as string,
            })
          }

          topPosts.sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
        }
      } catch (error: unknown) {
        log.error({ content: 'WordPress posts/summary fetch failed', plugin: 'wordpress', error: (error as Error).message });
      }

      const totalEngagement = totalLikes + totalComments
      const engagementRate = publishedCount > 0 ? Math.round((totalEngagement / publishedCount) * 10) / 10 : 0
      const base64Picture = stats.avatar ? await fetchedImageBase64(stats.avatar as string) : undefined

      return {
        platform: 'wordpress',
        accountId: socialMediaAccount.accountId || '',
        username: socialMediaAccount.username || socialMediaAccount.accountName || '',
        picture: base64Picture,
        fetchedAt: new Date().toISOString(),
        followers: ((stats.followers as Record<string, unknown>)?.count as number) || 0,
        posts: publishedCount || ((stats.posts as Record<string, unknown>)?.count as number) || 0,
        engagement: {
          total: totalEngagement,
          likes: totalLikes,
          comments: totalComments,
          impressions: totalViewsMonth,
          saves: totalWords,
        },
        growth: {
          followers: { absolute: ((stats.followers as Record<string, unknown>)?.count as number) || 0, percentage: 0 },
          posts: { absolute: publishedCount, percentage: 0 },
          engagement: { absolute: totalEngagement, percentage: engagementRate },
        },
        extra: {
          siteName: stats.name,
          siteDescription: stats.description,
          siteUrl: stats.URL,
          icon: stats.icon,
          totalViewsAllTime: (stats.views as Record<string, unknown>)?.total || 0,
          totalViewsMonth,
          totalViewsWeek,
          totalViewsDay,
          totalLikes,
          totalComments,
          totalWords,
          averageEngagementPerPost: publishedCount > 0 ? Math.round((totalEngagement / publishedCount) * 10) / 10 : 0,
          engagementRate,
          subscribersCount: ((stats.subscribers as Record<string, unknown>)?.count as number) || 0,
          publicizeFollowersCount: ((stats.followers as Record<string, unknown>)?.publicize as number) || 0,
          emailFollowersCount: ((stats.followers as Record<string, unknown>)?.email as number) || 0,
          topPosts: topPosts.slice(0, 10),
          trafficData: {
            viewsByDay: totalViewsDay,
            viewsByWeek: totalViewsWeek,
            viewsByMonth: totalViewsMonth,
          },
        },
      };
    } catch (error: unknown) {
      log.error({ content: 'WordPress Error fetching stats', plugin: 'wordpress', error: (error as Error).message });
      this.logPluginEvent('get-stats', 'failure', `Error: ${(error as Error).message}`);
      return this.createZeroStats(socialMediaAccount);
    }
  }

  private createZeroStats(socialMediaAccount: PluginSocialMediaAccount): PlatformStats {
    return {
      platform: 'wordpress',
      accountId: socialMediaAccount.accountId || '',
      username: socialMediaAccount.username || socialMediaAccount.accountName || '',
      fetchedAt: new Date().toISOString(),
      followers: 0,
      posts: 0,
    };
  }

  static readonly pluginName = 'wordpress';
  readonly pluginName = 'wordpress';

  private getPlatformData(postDetails: PluginPostDetails) {
    const platformName = this.pluginName;
    const platformContent = (postDetails.platformContent as Record<string, { content: string; comments?: string[] } | undefined>)?.[platformName];
    const platformSettings = (postDetails.platformSettings as Record<string, unknown>)?.[platformName] as WordPressSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings: platformSettings,
      postFormat: postDetails.postFormat || 'post'
    };
  }

  public override exposedMethods = [
    'wordPressMaxLength',
    'getCategories',
    'getTags',
  ] as const;
  override maxConcurrentJob = platformConfigurations.wordpress.maxConcurrentJob;

  wordPressMaxLength() {
    return platformConfigurations.wordpress.maxPostLength;
  }

  protected init(options?: Record<string, unknown>): void {
    console.log('WordPress plugin initialized', options);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];
    if (!post.content || post.content.trim() === '') {
      errors.push('Post content cannot be empty.');
    }
    return Promise.resolve(errors);
  }

  /**
   * Get site categories
   */
  async getCategories(siteUrl: string, accessToken: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(`${siteUrl}/wp-json/wp/v2/categories`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.json();
  }

  /**
   * Get site tags
   */
  async getTags(siteUrl: string, accessToken: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(`${siteUrl}/wp-json/wp/v2/tags`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.json();
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const siteUrl = socialMediaAccount.accountId;

      if (!siteUrl) {
        throw new Error('WordPress site URL is required in account settings');
      }

      const settings = postDetails.settings as Record<string, unknown>;

      const postData: Record<string, unknown> = {
        title: postDetails.title || 'Untitled Post',
        content: postDetails.content,
        status: settings?.status || 'publish', // draft, pending, publish, future
        excerpt: settings?.excerpt || '',
      };

      // Add categories
      if (settings?.categories && Array.isArray(settings.categories)) {
        postData.categories = settings.categories;
      }

      // Add tags
      if (settings?.tags && Array.isArray(settings.tags)) {
        postData.tags = settings.tags;
      }

      // Add featured media
      if (postDetails.assets && postDetails.assets.length > 0) {
        const imageAsset = postDetails.assets.find((asset: Asset) =>
          asset.mimeType.includes('image')
        );

        if (imageAsset && settings?.featured_media_id) {
          postData.featured_media = settings.featured_media_id;
        }
      }

      // Set publish date if scheduling
      if (settings?.date) {
        postData.date = settings.date;
        postData.status = 'future';
      }

      const response = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`WordPress API error: ${error}`);
      }

      const data = await response.json();

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: String(data.id),
        releaseURL: data.link,
        status: 'published',
      };

      this.emit('wordpress:post:published', { postId: postResponse.postId, response: data });
      return postResponse;
    } catch (error: unknown) {
      log.error({ content: 'WordPress post failed', plugin: 'wordpress', error: (error as Error).message });
      this.logPluginEvent('post-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id);
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('wordpress:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      if (!postDetails.postId) {
        throw new Error('Post ID is required for updating');
      }

      const siteUrl = socialMediaAccount.metadata?.siteUrl;

      if (!siteUrl) {
        throw new Error('WordPress site URL is required');
      }

      const settings = postDetails.settings as Record<string, unknown>;

      const postData: Record<string, unknown> = {
        title: postDetails.title || 'Untitled Post',
        content: postDetails.content,
      };

      if (settings?.status) {
        postData.status = settings.status;
      }
      if (settings?.excerpt) {
        postData.excerpt = settings.excerpt;
      }
      if (settings?.categories) {
        postData.categories = settings.categories;
      }
      if (settings?.tags) {
        postData.tags = settings.tags;
      }

      const response = await fetch(
        `${siteUrl}/wp-json/wp/v2/posts/${postDetails.postId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${socialMediaAccount.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postData),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`WordPress API error: ${error}`);
      }

      const data = await response.json();

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: String(data.id),
        releaseURL: data.link,
        status: 'published',
      };

      this.emit('wordpress:post:updated', { postId: postResponse.postId, postDetails });
      return postResponse;
    } catch (error: unknown) {
      log.error({ content: 'WordPress update failed', plugin: 'wordpress', error: (error as Error).message });
      this.logPluginEvent('update-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id);
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('wordpress:post:update:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async addComment(
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      if (!postDetails.postId) {
        throw new Error('Post ID is required for commenting');
      }

      const siteUrl = socialMediaAccount.metadata?.siteUrl;

      if (!siteUrl) {
        throw new Error('WordPress site URL is required');
      }

      const commentData = {
        post: postDetails.postId,
        content: commentDetails.content,
      };

      const response = await fetch(`${siteUrl}/wp-json/wp/v2/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commentData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`WordPress comment failed: ${error}`);
      }

      const data = await response.json();

      const commentResponse: PostResponse = {
        id: commentDetails.id,
        postId: String(data.id),
        releaseURL: data.link,
        status: 'published',
      };

      this.emit('wordpress:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
      return commentResponse;
    } catch (error: unknown) {
      log.error({ content: 'WordPress comment failed', plugin: 'wordpress', error: (error as Error).message });
      this.logPluginEvent('comment-error', 'failure', `Error: ${(error as Error).message}`, commentDetails.id);
      const errorResponse: PostResponse = {
        id: commentDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('wordpress:comment:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  /**
   * Transform WordPress comment to PlatformComment format
   */
  private transformComment(comment: Record<string, unknown>): PlatformComment {
    return {
      id: String(comment.id),
      text: comment.content?.rendered || comment.content || '',
      authorName: comment.author_name || 'Unknown',
      authorId: String(comment.author),
      authorPicture: comment.author_avatar_urls?.['48'],
      createdAt: comment.date,
      likeCount: comment.like_count || 0,
      replyCount: comment.comment_reply_count || 0,
      parentId: comment.parent ? String(comment.parent) : undefined,
    };
  }

  /**
   * Get comments for a WordPress post
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
      const settings = this.getSettings() as WordPressSettings;
      const baseUrl = settings.siteUrl.replace(/\/$/, '');
      const restBase = settings.restBase || 'wp-json/wp/v2';

      const params = new URLSearchParams({
        post: externalPostId,
        per_page: String(options?.limit || 50),
        page: options?.cursor || '1',
      });

      const response = await fetch(`${baseUrl}/${restBase}/comments?${params.toString()}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${settings.username}:${settings.applicationPassword}`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`WordPress get comments failed: ${error}`);
      }

      const data = await response.json();
      const headers = response.headers;

      const comments: PlatformComment[] = data
        .filter((comment: Record<string, unknown>) => !comment.parent)
        .map((comment) => this.transformComment(comment as Record<string, unknown>));

      const totalPages = parseInt(headers.get('X-WP-TotalPages') || '1', 10);
      const currentPage = parseInt(options?.cursor || '1', 10);

      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments,
        hasMore: currentPage < totalPages,
        nextCursor: currentPage < totalPages ? String(currentPage + 1) : undefined,
      };
    } catch (error: unknown) {
      log.error({ content: 'Error fetching WordPress comments', plugin: 'wordpress', error: (error as Error).message });
      this.logPluginEvent('get-comments', 'failure', `Error: ${(error as Error).message}`);
      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments: [],
        hasMore: false,
      };
    }
  }

  /**
   * Reply to a comment on WordPress
   */
  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    try {
      const platformPost = postDetails.platformPosts?.find((pp) => pp.socialAccountId === socialMediaAccount.id);
      const publishDetail = platformPost?.publishDetail ? JSON.parse(platformPost.publishDetail) : {};
      const externalPostId = publishDetail[socialMediaAccount.id]?.publishedId || publishDetail.postId;

      const settings = this.getSettings() as WordPressSettings;
      const baseUrl = settings.siteUrl.replace(/\/$/, '');
      const restBase = settings.restBase || 'wp-json/wp/v2';

      const response = await fetch(`${baseUrl}/${restBase}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${settings.username}:${settings.applicationPassword}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: replyText,
          post: externalPostId,
          parent: parseInt(commentId, 10),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`WordPress reply failed: ${error}`);
      }

      const data = await response.json();

      return {
        success: true,
        comment: this.transformComment(data),
      };
    } catch (error: unknown) {
      log.error({ content: 'Error replying to WordPress comment', plugin: 'wordpress', error: (error as Error).message });
      this.logPluginEvent('reply-comment-error', 'failure', `Error: ${(error as Error).message}`, commentId);
      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to comment',
      };
    }
  }
}
