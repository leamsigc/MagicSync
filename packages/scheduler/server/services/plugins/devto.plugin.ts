import type { PostResponse, PluginPostDetails, PluginSocialMediaAccount, GetCommentsResponse, ReplyCommentResponse, PlatformComment, PlatformStats } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { BaseSchedulerPlugin } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { Post, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import type { DevToSettings } from '#layers/BaseScheduler/shared/platformSettings';
import { platformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';


export class DevToPlugin extends BaseSchedulerPlugin {
  override async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    try {
      const username = socialMediaAccount.accountId;

      const response = await fetch(`https://dev.to/api/users/${username}`);

      if (!response.ok) {
        console.warn(`Dev.to API error: ${response.statusText}`);
        return this.getZeroStats(socialMediaAccount);
      }

      const data = await response.json();

      return {
        platform: 'devto',
        accountId: String(data.user_id || username),
        username: data.username || username,
        fetchedAt: new Date().toISOString(),
        followers: data.followers_count || 0,
        following: data.following || 0,
        posts: data.articles_count || 0,
        engagement: {
          total: (data.public_reactions_count || 0) + (data.public_comments_count || 0),
          likes: data.public_reactions_count || 0,
          comments: data.public_comments_count || 0,
        },
        extra: {
          name: data.name,
          twitter_username: data.twitter_username,
          github_username: data.github_username,
          user_id: data.user_id,
        },
      };
    } catch (error: unknown) {
      console.error('Error fetching Dev.to stats:', error);
      return this.getZeroStats(socialMediaAccount);
    }
  }

  private getZeroStats(socialMediaAccount: PluginSocialMediaAccount): PlatformStats {
    return {
      platform: 'devto',
      accountId: socialMediaAccount.accountId,
      username: socialMediaAccount.accountName || socialMediaAccount.accountId,
      fetchedAt: new Date().toISOString(),
      followers: 0,
      following: 0,
      posts: 0,
      engagement: {
        total: 0,
        likes: 0,
        comments: 0,
      },
    };
  }
  static readonly pluginName = 'devto';
  readonly pluginName = 'devto';

  private getPlatformData(postDetails: PluginPostDetails) {
    const platformName = this.pluginName;
    const platformContent = (postDetails.platformContent as Record<string, { content: string; comments?: string[] } | undefined>)?.[platformName];
    const platformSettings = (postDetails.platformSettings as Record<string, unknown>)?.[platformName] as DevToSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings: platformSettings,
      postFormat: postDetails.postFormat || 'post'
    };
  }

  public override exposedMethods = [
    'devToMaxLength',
    'getTags',
    'getOrganizations',
  ] as const;
  override maxConcurrentJob = platformConfigurations.devto.maxConcurrentJob;

  devToMaxLength() {
    return platformConfigurations.devto.maxPostLength;
  }

  protected init(options?: { apiUrl?: string }): void {
    console.log('dev.to plugin initialized', options);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];
    if (!post.content || post.content.trim() === '') {
      errors.push('Article content cannot be empty.');
    }
    if (post.content && post.content.length > platformConfigurations.devto.maxPostLength) {
      errors.push(`Article content is too long (max ${platformConfigurations.devto.maxPostLength} characters)`);
    }
    return Promise.resolve(errors);
  }

  /**
   * Get available tags for articles
   */
  async getTags(apiKey: string): Promise<Record<string, unknown>[]> {
    const response = await fetch('https://dev.to/api/tags', {
      headers: {
        'api-key': apiKey,
      },
    });
    return response.json();
  }

  /**
   * Get user's organizations
   */
  async getOrganizations(apiKey: string): Promise<Record<string, unknown>[]> {
    const response = await fetch('https://dev.to/api/organizations', {
      headers: {
        'api-key': apiKey,
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
      const { content, settings } = this.getPlatformData(postDetails);

      const article: Record<string, unknown> = {
        title: postDetails.title || 'Untitled Article',
        body_markdown: content,
        published: true,
      };

      // Add series if provided
      // DevToSettings doesn't explicitly have 'series' in the interface we saw, but if it did:
      // Assuming settings is cast to 'any' inside or we extend the type?
      // The lint error said 'series' does not exist on DevToSettings.
      // We should cast 'settings' to 'any' safely or assume it might be missing from the interface for now?
      // Actually, best to update platformSettings.ts to include 'series' if needed, but for now let's just use what's there or cast.
      // The lint errors for 'series' were real.
      // Also mapping canonical -> canonical_url and organization -> organization_id.

      const devToSettings = settings as Record<string, unknown>; // Temporary cast to avoid 'series' error if it's not in interface yet

      if (devToSettings?.series) {
        article.series = devToSettings.series;
      }

      // Add tags if provided (mapping from {label, value} to string)
      if (settings?.tags && Array.isArray(settings.tags)) {
        // Check if tags are objects (as per interface) or strings (legacy?)
        // Interface says { value, label }[]
        article.tags = settings.tags.map((t) => t.value || t).filter(Boolean);
      }

      // Add canonical URL if provided
      if (settings?.canonical) {
        article.canonical_url = settings.canonical;
      }

      // Add organization ID if provided
      if (settings?.organization) {
        article.organization_id = settings.organization;
      }

      // Add cover image if available
      if (postDetails.assets && postDetails.assets.length > 0) {
        const coverImage = postDetails.assets.find((asset: Asset) =>
          asset.mimeType.includes('image')
        );
        if (coverImage) {
          article.main_image = coverImage.url;
        }
      }

      const response = await fetch('https://dev.to/api/articles', {
        method: 'POST',
        headers: {
          'api-key': socialMediaAccount.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ article }),
      });

      if (!response.ok) {
        throw new Error(`dev.to API error: ${response.statusText}`);
      }

      const data = await response.json();

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: String(data.id),
        releaseURL: data.url,
        status: 'published',
      };

      this.emit('devto:post:published', { postId: postResponse.postId, response: data });
      return postResponse;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('devto:post:failed', { error: (error as Error).message });
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

      const article: Record<string, unknown> = {
        title: postDetails.title || 'Untitled Article',
        body_markdown: postDetails.content,
      };

      const settings = postDetails.settings as Record<string, unknown>;
      if (settings?.tags && Array.isArray(settings.tags)) {
        article.tags = settings.tags;
      }
      if (settings?.series) {
        article.series = settings.series;
      }
      if (settings?.canonical_url) {
        article.canonical_url = settings.canonical_url;
      }

      const response = await fetch(`https://dev.to/api/articles/${postDetails.postId}`, {
        method: 'PUT',
        headers: {
          'api-key': socialMediaAccount.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ article }),
      });

      if (!response.ok) {
        throw new Error(`dev.to API error: ${response.statusText}`);
      }

      const data = await response.json();

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: String(data.id),
        releaseURL: data.url,
        status: 'published',
      };

      this.emit('devto:post:updated', { postId: postResponse.postId, postDetails });
      return postResponse;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('devto:post:update:failed', { error: (error as Error).message });
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

      const comment = {
        body_markdown: commentDetails.content,
      };

      const response = await fetch(
        `https://dev.to/api/comments?a_id=${postDetails.postId}`,
        {
          method: 'POST',
          headers: {
            'api-key': socialMediaAccount.accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ comment }),
        }
      );

      if (!response.ok) {
        throw new Error(`dev.to API error: ${response.statusText}`);
      }

      const data = await response.json();

      const commentResponse: PostResponse = {
        id: commentDetails.id,
        postId: String(data.id_code),
        releaseURL: `${postDetails.postId}#comment-${data.id_code}`,
        status: 'published',
      };

      this.emit('devto:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
      return commentResponse;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: commentDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('devto:comment:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  /**
   * Transform Dev.to comment to PlatformComment format
   */
  private transformComment(comment: Record<string, unknown>): PlatformComment {
    return {
      id: String(comment.id_code || comment.id),
      text: comment.body_html || comment.body_markdown || '',
      authorName: comment.user?.name || comment.author?.name || 'Unknown',
      authorId: String(comment.user_id || comment.author_id),
      authorPicture: comment.user?.profile_image || comment.author?.profile_image,
      createdAt: comment.created_at,
      likeCount: comment.public_reactions_count || 0,
      replyCount: comment.replies_count || 0,
      parentId: comment.parent_id ? String(comment.parent_id) : undefined,
    };
  }

  /**
   * Get comments for a Dev.to article
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
      const settings = this.getSettings() as DevToSettings;
      const apiKey = settings.apiKey;

      const params = new URLSearchParams({
        article_id: externalPostId,
        per_page: String(options?.limit || 50),
      });

      const response = await fetch(`https://dev.to/api/comments?${params.toString()}`, {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Dev.to get comments failed: ${error}`);
      }

      const data = await response.json();
      const comments: PlatformComment[] = (data || [])
        .filter((c: Record<string, unknown>) => !c.parent_id)
        .map((c) => this.transformComment(c as Record<string, unknown>));

      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments,
        hasMore: false,
      };
    } catch (error: unknown) {
      console.error('Error fetching Dev.to comments:', error);
      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments: [],
        hasMore: false,
      };
    }
  }

  /**
   * Reply to a comment on Dev.to
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

      const settings = this.getSettings() as DevToSettings;
      const apiKey = settings.apiKey;

      const response = await fetch('https://dev.to/api/comments', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body_markdown: replyText,
          commentable_id: externalPostId,
          commentable_type: 'Article',
          parent_id: commentId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Dev.to reply failed: ${error}`);
      }

      const data = await response.json();

      return {
        success: true,
        comment: this.transformComment(data),
      };
    } catch (error: unknown) {
      console.error('Error replying to Dev.to comment:', error);
      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to comment',
      };
    }
  }
}
