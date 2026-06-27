import type { PostDetails, PostResponse, Integration, PluginPostDetails, PluginSocialMediaAccount, GetCommentsResponse, ReplyCommentResponse, PlatformComment } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import type { RedditSettings } from '../../../shared/platformSettings';

import { platformConfigurations } from '../../../shared/platformConstants';

export class RedditPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'reddit';
  readonly pluginName = 'reddit';

  private getPlatformData(postDetails: PostWithAllData) {
    const platformName = this.pluginName;
    const platformContent = (postDetails.platformContent as Record<string, { content: string; comments?: string[] } | undefined>)?.[platformName];
    const platformSettings = (postDetails.platformSettings as Record<string, unknown>)?.[platformName] as RedditSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings: platformSettings,
      postFormat: postDetails.postFormat || 'post'
    };
  }

  public override exposedMethods = [
    'redditMaxLength',
    'getSubreddits',
    'getUser',
  ] as const;
  override maxConcurrentJob = platformConfigurations.reddit.maxConcurrentJob; // Reddit has strict rate limits (1 request per second)

  redditMaxLength() {
    return platformConfigurations.reddit.maxPostLength; // Self-post body limit
  }

  protected init(options?: Record<string, unknown>): void {
    console.log('Reddit plugin initialized', options);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];

    if (!post.content || post.content.trim() === '') {
      errors.push('Post content cannot be empty.');
    }

    if (post.content && post.content.length > platformConfigurations.reddit.maxPostLength) {
      errors.push(`Post content is too long (max ${platformConfigurations.reddit.maxPostLength} characters)`);
    }

    return Promise.resolve(errors);
  }

  /**
   * Get user's subscribed subreddits
   */
  async getSubreddits(accessToken: string): Promise<Record<string, unknown>[]> {
    const response = await fetch('https://oauth.reddit.com/subreddits/mine/subscriber', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'PostScheduler/1.0',
      },
    });
    const data = await response.json() as Record<string, unknown>;
    const children = (data.data as Record<string, unknown>).children as Record<string, unknown>[];
    return children.map((child) => (child.data as Record<string, unknown>));
  }

  /**
   * Get authenticated user information
   */
  async getUser(accessToken: string): Promise<Record<string, unknown>> {
    const response = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'PostScheduler/1.0',
      },
    });
    return response.json();
  }

  /**
   * Upload media to Reddit
   */
  private async uploadMedia(subreddit: string, asset: Asset, accessToken: string): Promise<string> {
    const mimeType = asset.mimeType;
    const filename = getPublicUrlForAsset(asset.url) || 'upload';

    // Step 1: Get upload lease
    const formData = new FormData();
    formData.append('filepath', filename);
    formData.append('mimetype', mimeType);

    const leaseResponse = await fetch(
      'https://oauth.reddit.com/api/media/asset',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'PostScheduler/1.0',
        },
        body: formData,
      }
    );

    const leaseData = await leaseResponse.json();
    const { action, fields } = leaseData.args;

    // Step 2: Upload file to S3
    const uploadFormData = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      uploadFormData.append(key, value as string);
    });

    const fileResponse = await fetch(asset.url);
    const fileBlob = await fileResponse.blob();
    uploadFormData.append('file', fileBlob, filename);

    await fetch(action, {
      method: 'POST',
      body: uploadFormData,
    });

    return leaseData.asset.asset_id;
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const settings = postDetails.settings as RedditSettings;
      const subreddit = settings?.subreddit;

      if (!subreddit) {
        throw new Error('Subreddit is required. Please specify in post settings.');
      }

      const submitData: Record<string, unknown> = {
        sr: subreddit,
        kind: 'self', // Default to self-post (text)
        title: postDetails.title || postDetails.content.substring(0, 300),
        text: postDetails.content,
        sendreplies: true,
      };

      // Handle different post types
      if (postDetails.assets && postDetails.assets.length > 0) {
        const imageAsset = postDetails.assets.find((asset: Asset) =>
          asset.mimeType.includes('image')
        );
        const videoAsset = postDetails.assets.find((asset: Asset) =>
          asset.mimeType.includes('video')
        );

        if (videoAsset) {
          // Video post
          const videoId = await this.uploadMedia(subreddit, videoAsset, socialMediaAccount.accessToken);
          submitData.kind = 'videogif';
          submitData.video_poster_url = getPublicUrlForAsset(videoAsset.url);
          delete submitData.text;
        } else if (imageAsset) {
          // Image post
          submitData.kind = 'image';
          submitData.url = getPublicUrlForAsset(imageAsset.url);
          delete submitData.text;
        }
      } else if (settings?.url) {
        // Link post
        submitData.kind = 'link';
        submitData.url = settings.url;
        delete submitData.text;
      }

      // Cleanup and finalize data types
      if (settings?.url && !submitData.url) {
        submitData.url = settings.url;
      }

      // Ensure type is set
      if (!submitData.kind) {
        submitData.kind = settings?.type || 'self';
      }

      if (submitData.kind === 'link' || submitData.kind === 'image' || submitData.kind === 'video') {
        delete submitData.text; // URL posts don't have text body usually? Or they can?
        // Reddit API: link posts use 'url', self posts use 'text'.
        if (submitData.kind === 'self') delete submitData.url;
        else delete submitData.text;
      }

      if (settings?.subreddit?.flair?.id) {
        submitData.flair_id = settings.subreddit.flair.id;
      }
      if (settings?.subreddit?.flair?.text) {
        submitData.flair_text = settings.subreddit.flair.text;
      }

      const response = await fetch('https://oauth.reddit.com/api/submit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PostScheduler/1.0',
        },
        body: new URLSearchParams(submitData as Record<string, string>),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Reddit API error: ${error}`);
      }

      const data = await response.json();

      if (data.json.errors && data.json.errors.length > 0) {
        throw new Error(`Reddit submission error: ${JSON.stringify(data.json.errors)}`);
      }

      const postId = data.json.data.name; // fullname like "t3_abc123"
      const permalink = data.json.data.url;

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId,
        releaseURL: permalink,
        status: 'published',
      };

      this.emit('reddit:post:published', { postId: postResponse.postId, response: data });

      // Wait 1 second due to rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));

      return postResponse;
    } catch (error: unknown) {
      log.error({ content: 'Reddit post failed', plugin: 'reddit', error: (error as Error).message });
      this.logPluginEvent('post-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id);
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('reddit:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const publicationDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
      if (!publicationDetails) {
        throw new Error('Published platform details not found');
      }
      const details = JSON.parse(publicationDetails.publishDetail as unknown as string || '{}') as PostResponse;
      const postId = details.postId;

      if (!postId) {
        throw new Error('Post ID is required for updating');
      }

      // Reddit only allows editing self-post text, not title or other content
      const response = await fetch('https://oauth.reddit.com/api/editusertext', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PostScheduler/1.0',
        },
        body: new URLSearchParams({
          thing_id: postId,
          text: postDetails.content,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Reddit API error: ${error}`);
      }

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: postId,
        releaseURL: details.releaseURL || '',
        status: 'published',
      };

      this.emit('reddit:post:updated', { postId: postResponse.postId, postDetails });

      // Wait 1 second due to rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));

      return postResponse;
    } catch (error: unknown) {
      log.error({ content: 'Reddit update failed', plugin: 'reddit', error: (error as Error).message });
      this.logPluginEvent('update-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id);
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('reddit:post:update:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    try {
      const accessToken = socialMediaAccount.accessToken

      const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'PostScheduler/1.0',
        },
      })

      if (!userResponse.ok) {
        return this.getZeroStats(socialMediaAccount)
      }

      const profile = await userResponse.json() as Record<string, unknown>
      const username = profile.name as string

      let totalPosts = 0
      let totalScore = 0
      let totalComments = 0
      let totalUpvotes = 0
      let totalDownvotes = 0
      const topPosts: Array<{ id: string; title: string; subreddit: string; score: number; numComments: number; upvoteRatio: number; created: number; url: string }> = []

      try {
        const submissionsResponse = await fetch(
          `https://oauth.reddit.com/user/${username}/submitted?limit=100&raw_json=1&sort=new`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'User-Agent': 'PostScheduler/1.0',
            },
          }
        )

        if (submissionsResponse.ok) {
          const submissions = await submissionsResponse.json() as Record<string, unknown>
          const posts = (submissions.data as Record<string, unknown>)?.children as Array<Record<string, unknown>> || []
          totalPosts = posts.length

          for (const post of posts) {
            const d = post.data as Record<string, unknown> || {}
            const score = (d.score as number) || 0
            const numComments = (d.num_comments as number) || 0
            totalScore += score
            totalComments += numComments
            if (score > 0) totalUpvotes += score
            if (score < 0) totalDownvotes += Math.abs(score)
            topPosts.push({
              id: d.id as string,
              title: (d.title as string)?.substring(0, 200) || '',
              subreddit: d.subreddit as string,
              score,
              numComments,
              upvoteRatio: (d.upvote_ratio as number) || 1,
              created: (d.created_utc as number) || 0,
              url: d.url as string || `https://reddit.com${d.permalink as string}`,
            })
          }

          topPosts.sort((a, b) => b.score - a.score)
        }
      } catch (error: unknown) {
        log.error({ content: 'Reddit submissions fetch failed', plugin: 'reddit', error: (error as Error).message });
      }

      let totalCommentKarma = 0
      let recentCommentsCount = 0
      try {
        const commentsResponse = await fetch(
          `https://oauth.reddit.com/user/${username}/comments?limit=100&raw_json=1&sort=new`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'User-Agent': 'PostScheduler/1.0',
            },
          }
        )

        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json() as Record<string, unknown>
          const comments = (commentsData.data as Record<string, unknown>)?.children as Array<Record<string, unknown>> || []
          recentCommentsCount = comments.length
          for (const comment of comments) {
            totalCommentKarma += (comment.data as Record<string, unknown>)?.score as number || 0
          }
        }
      } catch (error: unknown) {
        log.error({ content: 'Reddit comments fetch failed', plugin: 'reddit', error: (error as Error).message });
      }

      const totalEngagement = totalScore + totalComments + totalCommentKarma
      const engagementRate = totalPosts > 0 ? Math.round((totalScore / totalPosts) * 100) / 100 : 0

      const pictureUrl = (profile.icon_img as string)?.split('?')[0]
      const base64Picture = pictureUrl ? await fetchedImageBase64(pictureUrl) : undefined

      return {
        platform: 'reddit',
        accountId: (profile.id as string) || socialMediaAccount.accountId,
        username: username || socialMediaAccount.accountName || '',
        picture: base64Picture,
        fetchedAt: new Date().toISOString(),
        followers: (profile.num_friends as number) || 0,
        posts: totalPosts,
        engagement: {
          total: totalEngagement,
          likes: totalUpvotes,
          comments: totalComments,
          saves: totalCommentKarma,
          impressions: totalScore,
        },
        growth: {
          followers: { absolute: (profile.num_friends as number) || 0, percentage: 0 },
          posts: { absolute: totalPosts, percentage: 0 },
          engagement: { absolute: totalEngagement, percentage: engagementRate * 10 },
        },
        extra: {
          linkKarma: profile.link_karma || 0,
          commentKarma: profile.comment_karma || 0,
          totalPostScore: totalScore,
          totalPostComments: totalComments,
          totalCommentKarmaRecent: totalCommentKarma,
          recentCommentsCount,
          averageScorePerPost: totalPosts > 0 ? Math.round((totalScore / totalPosts) * 10) / 10 : 0,
          engagementRate,
          isGold: profile.is_gold,
          isMod: profile.is_mod,
          isEmployee: profile.is_employee,
          hasVerifiedEmail: profile.has_verified_email,
          over18: profile.over_18,
          createdUtc: profile.created_utc,
          topPosts: topPosts.slice(0, 10),
        },
      }
    } catch (error: unknown) {
      log.error({ content: 'Error fetching Reddit stats', plugin: 'reddit', error: (error as Error).message });
      this.logPluginEvent('get-stats', 'failure', `Error: ${(error as Error).message}`);
      return this.getZeroStats(socialMediaAccount);
    }
  }

  private getZeroStats(socialMediaAccount: PluginSocialMediaAccount): PlatformStats {
    return {
      platform: 'reddit',
      accountId: socialMediaAccount.accountId,
      username: socialMediaAccount.accountName || socialMediaAccount.accountId,
      fetchedAt: new Date().toISOString(),
      followers: 0,
      posts: 0,
      engagement: { total: 0 },
    }
  }

  override async addComment(
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      if (!postDetails.postId) {
        throw new Error('Post ID is required for commenting');
      }

      const response = await fetch('https://oauth.reddit.com/api/comment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PostScheduler/1.0',
        },
        body: new URLSearchParams({
          thing_id: postDetails.postId,
          text: commentDetails.content,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Reddit comment failed: ${error}`);
      }

      const data = await response.json();
      const commentId = data.json.data.things[0].data.name;

      const commentResponse: PostResponse = {
        id: commentDetails.id,
        postId: commentId,
        releaseURL: postDetails.releaseURL || '',
        status: 'published',
      };

      this.emit('reddit:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });

      // Wait 1 second due to rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));

      return commentResponse;
    } catch (error: unknown) {
      log.error({ content: 'Reddit comment failed', plugin: 'reddit', error: (error as Error).message });
      this.logPluginEvent('comment-error', 'failure', `Error: ${(error as Error).message}`, commentDetails.id);
      const errorResponse: PostResponse = {
        id: commentDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('reddit:comment:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  /**
   * Transform Reddit comment to PlatformComment format
   */
  private transformComment(comment: Record<string, unknown>): PlatformComment {
    return {
      id: comment.data?.name || comment.id,
      text: comment.data?.body || comment.body || '',
      authorName: comment.data?.author || comment.author || 'Unknown',
      authorId: comment.data?.author_fullname || comment.author,
      createdAt: comment.data?.created_utc ? new Date(comment.data.created_utc * 1000).toISOString() : '',
      likeCount: comment.data?.ups || 0,
      replyCount: comment.data?.num_comments || 0,
      parentId: comment.data?.parent_id,
    };
  }

  /**
   * Get comments for a Reddit post
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
      // Extract article ID from fullname (e.g., t3_abc123 -> abc123)
      const articleId = externalPostId.replace('t3_', '');

      const params = new URLSearchParams({
        limit: String(options?.limit || 50),
        raw_json: '1',
      });

      if (options?.cursor) {
        params.append('after', options.cursor);
      }

      const response = await fetch(
        `https://oauth.reddit.com/r/all/comments/${articleId}.json?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${socialMediaAccount.accessToken}`,
            'User-Agent': 'PostScheduler/1.0',
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Reddit get comments failed: ${error}`);
      }

      const data = await response.json();
      // Reddit returns [post_data, comments_data] structure
      const commentsData = data[1]?.data?.children || [];
      const comments: PlatformComment[] = commentsData.map((c) => this.transformComment(c as Record<string, unknown>));

      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments,
        hasMore: !!data[1]?.data?.after,
        nextCursor: data[1]?.data?.after,
      };
    } catch (error: unknown) {
      log.error({ content: 'Error fetching Reddit comments', plugin: 'reddit', error: (error as Error).message });
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
   * Reply to a comment on Reddit
   */
  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    try {
      const response = await fetch('https://oauth.reddit.com/api/comment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PostScheduler/1.0',
        },
        body: new URLSearchParams({
          thing_id: commentId, // Reply to the parent comment
          text: replyText,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Reddit reply failed: ${error}`);
      }

      const data = await response.json();
      const newComment = data.json.data.things[0].data;

      return {
        success: true,
        comment: this.transformComment(newComment),
      };
    } catch (error: unknown) {
      log.error({ content: 'Error replying to Reddit comment', plugin: 'reddit', error: (error as Error).message });
      this.logPluginEvent('reply-comment-error', 'failure', `Error: ${(error as Error).message}`, commentId);
      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to comment',
      };
    }
  }
}
