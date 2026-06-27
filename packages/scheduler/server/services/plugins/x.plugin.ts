import type { PostDetails, PostResponse, Integration, PluginPostDetails, PluginSocialMediaAccount, GetCommentsResponse, ReplyCommentResponse, PlatformComment } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent, type PlatformStats } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset, PlatformContentOverride } from '#layers/BaseDB/db/schema';
import { TwitterApi } from 'twitter-api-v2';
import { platformConfigurations } from '../../../shared/platformConstants';
import type { TwitterSettings } from '../../../shared/platformSettings';
import { promises as fs } from 'node:fs'

export class XPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'twitter';
  readonly pluginName = 'twitter';
  public override exposedMethods = [
    'xMaxLength',
    'getUser',
    'getTweetMetrics',
  ] as const;
  override maxConcurrentJob = platformConfigurations.twitter.maxConcurrentJob; // X has strict rate limits (300 posts per 3 hours)

  private normalizeContent(content: string): string {
    if (!content) return '';
    return content
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }

  xMaxLength(isPremium: boolean = false) {
    return isPremium ? 4000 : 280;
  }

  protected init(options?: Record<string, unknown>): void {
    console.log('X (Twitter) plugin initialized', options);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];
    const settings = (post as Post & { settings?: Record<string, unknown> }).settings;
    const isPremium = (settings?.isPremium as boolean | undefined) || false;
    const maxLength = this.xMaxLength(isPremium);

    if (!post.content || post.content.trim() === '') {
      errors.push('Tweet content cannot be empty.');
    }

    if (post.content && post.content.length > maxLength) {
      errors.push(`Tweet is too long (max ${maxLength} characters)`);
    }

    return Promise.resolve(errors);
  }

  /**
   * Get authenticated user information
   */
  async getUser(accessToken: string) {
    const client = new TwitterApi(accessToken);

    const user = await client.v2.me();
    if (user.data.profile_image_url) {
      user.data.profile_image_url = await fetchedImageBase64(user.data.profile_image_url);
    }
    return user.data;
  }

  /**
   * Get tweet metrics
   */
  async getTweetMetrics(tweetId: string, accessToken: string) {
    const client = new TwitterApi(accessToken);

    const tweet = await client.v2.singleTweet(tweetId, {
      'tweet.fields': ['public_metrics', 'created_at'],
    });

    return tweet.data;
  }

  /**
   * Process and optimize image for X
   */
  private async processImage(asset: Asset): Promise<Buffer> {
    const imageUrl = getFileFromAsset(asset);
    const { buffer } = await reduceImageBySize(imageUrl, 5 * 1024); // 5MB = 5120 KB
    return buffer;
  }
  private getPlatformData(postDetails: PostWithAllData, platformPost?: Record<string, unknown>) {
    const platformName = this.pluginName;
    const platformContent = (postDetails.platformContent as unknown as Record<string, PlatformContentOverride | undefined>)?.[platformName];
    const platformSettings = (postDetails.platformSettings as unknown as Record<string, unknown>)?.[platformName] as TwitterSettings | undefined;
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

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      // X stores token as "accessToken:accessSecret"
      const accessToken = socialMediaAccount.accessToken;

      if (!accessToken) {
        throw new Error('Invalid X authentication tokens');
      }

      const client = new TwitterApi(accessToken);

      const { comments: postComments } = this.getPlatformData(postDetails);

      // Use platform-specific content if available, otherwise use master content
      const postPlatformContent = postDetails.platformContent as unknown as Record<string, PlatformContentOverride | undefined> | undefined;
      const platformContent = postPlatformContent?.twitter
        || postPlatformContent?.x;
      const rawContent = platformContent?.content || postDetails.content;
      const contentToPost = this.normalizeContent(rawContent);

      const tweetOptions: Record<string, unknown> = {
        text: contentToPost,
      };

      // Handle media attachments
      if (postDetails.assets && postDetails.assets.length > 0) {
        const mediaIds: string[] = [];

        // X supports max 4 images or 1 video
        const imageAssets = postDetails.assets.filter((asset: Asset) =>
          asset.mimeType.includes('image')
        ).slice(0, 4);

        const videoAsset = postDetails.assets.find((asset: Asset) =>
          asset.mimeType.includes('video')
        );

        if (videoAsset) {
          // Upload video
          const videoUrl = getFileFromAsset(videoAsset);
          const videoResponse = await fs.readFile(videoUrl);

          const mediaId = await client.v1.uploadMedia(Buffer.from(videoResponse), {
            mimeType: videoAsset.mimeType,
          });

          mediaIds.push(mediaId);
        } else if (imageAssets.length > 0) {
          // Upload images
          for (const asset of imageAssets) {
            const imageBuffer = await this.processImage(asset);
            const mediaId = await client.v2.uploadMedia(imageBuffer, {
              media_type: asset.mimeType || ('image/jpeg' as const),
            });
            mediaIds.push(mediaId);
          }
        }

        if (mediaIds.length > 0) {
          tweetOptions.media = { media_ids: mediaIds };
        }
      }

      // Add poll if provided
      // if (settings?.poll && settings.poll.options && settings.poll.options.length > 0) {
      //   tweetOptions.poll = {
      //     options: settings.poll.options,
      //     duration_minutes: settings.poll.duration || 1440,
      //   };
      // }

      // Platform-specific settings from platformSettings
      const postPlatformSettings = postDetails.platformSettings as unknown as Record<string, TwitterSettings> | undefined;
      const platformSettings = postPlatformSettings?.twitter || postPlatformSettings?.x;
      if (platformSettings) {
        // Handle who_can_reply setting
        if (platformSettings.who_can_reply && platformSettings.who_can_reply !== 'everyone') {
          const replySettingsMap: Record<string, string> = {
            'following': 'following',
            'mentionedUsers': 'mentionedUsers',
            'subscribers': 'subscribers',
            'verified': 'verified',
          };
          if (replySettingsMap[platformSettings.who_can_reply]) {
            tweetOptions.reply_settings = replySettingsMap[platformSettings.who_can_reply];
          }
        }

        // Handle community posting
        if (platformSettings.community) {
          const communityMatch = platformSettings.community.match(/communities\/(\d+)/);
          if (communityMatch) {
            tweetOptions.community_id = communityMatch[1];
          }
        }
      }


      let tweet;
      let isThread = false;
      if (postComments.length > 0) {
        // Create a thread with main content and comments
        const threadTweets = [
          tweetOptions, // Main tweet with media, poll, settings
          ...postComments.map((comment: string) => ({ text: this.normalizeContent(comment) }))
        ];
        tweet = await client.v2.tweetThread(threadTweets);
        isThread = true;
      } else {
        // Single tweet
        tweet = await client.v2.tweet(tweetOptions);
      }

      // Add comment to post

      const tweetData = isThread ? (tweet as { data: { id: string } }[])[0] : tweet as { data: { id: string } };
      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: tweetData.data.id,
        releaseURL: `https://twitter.com/${socialMediaAccount.username}/status/${tweetData.data.id}`,
        status: 'published',
      };

      this.emit('x:post:published', { postId: postResponse.postId, response: tweetData.data });
      return postResponse;
    } catch (error: unknown) {
      log.error({ content: 'X post failed', plugin: 'twitter', error: (error as Error).message });
      this.logPluginEvent('post-error', 'failure', (error as Error).message);

      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('x:post:failed', { error: (error as Error).message });
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
        throw new Error('Tweet ID is required for updating');
      }

      const accessToken = socialMediaAccount.accessToken;
      const client = new TwitterApi(accessToken);

      // X (Free API) doesn't support editing.
      // Delete and recreate pattern changes the ID and URL which effectively is a new post.
      // Keeping consistent with previous behavior of deleting and posting new.

      // Create new tweet
      const newTweet = await client.v2.tweet(postDetails.content);

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: newTweet.data.id,
        releaseURL: `https://twitter.com/${socialMediaAccount.username}/status/${newTweet.data.id}`,
        status: 'published',
      };

      this.emit('x:post:updated', { postId: postResponse.postId, postDetails });
      return postResponse;
    } catch (error: unknown) {
      log.error({ content: 'X update failed', plugin: 'twitter', error: (error as Error).message });
      this.logPluginEvent('update-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id);
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('x:post:update:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  async getStatistic(
    postDetails: PostWithAllData,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PlatformStats> {
    const accessToken = socialMediaAccount.accessToken
    if (!accessToken) {
      throw new Error('Access token not found')
    }

    const profile = await this.getUser(accessToken)

    let totalEngagement = 0
    let totalPosts = 0
    let totalLikes = 0
    let totalRetweets = 0
    let totalReplies = 0
    let totalQuotes = 0
    let topTweets: Array<{ id: string; text: string; likes: number; retweets: number; replies: number; quotes: number; engagement: number }> = []

    try {
      const client = new TwitterApi(accessToken)
      const tweets = await client.v2.userTimeline(profile.id, {
        'tweet.fields': ['public_metrics', 'created_at'],
        max_results: 100,
      })
      const tweetList = tweets.tweets || []
      totalPosts = tweetList.length

      for (const tweet of tweetList) {
        const metrics = (tweet as { public_metrics?: Record<string, number> }).public_metrics || {}
        const likes = metrics.like_count || 0
        const retweets = metrics.retweet_count || 0
        const replies = metrics.reply_count || 0
        const quotes = metrics.quote_count || 0
        const engagement = likes + retweets + replies + quotes

        totalEngagement += engagement
        totalLikes += likes
        totalRetweets += retweets
        totalReplies += replies
        totalQuotes += quotes

        topTweets.push({
          id: tweet.id,
          text: (tweet as { text?: string }).text || '',
          likes,
          retweets,
          replies,
          quotes,
          engagement,
        })
      }

      topTweets.sort((a, b) => b.engagement - a.engagement)
      topTweets = topTweets.slice(0, 10)
    } catch (error: unknown) {
      log.error({ content: 'X timeline fetch failed', plugin: 'twitter', error: (error as Error).message });
    }

    const followersCount = profile.public_metrics?.followers_count || 0
    const engagementRate = followersCount > 0 && totalPosts > 0
      ? Math.round((totalEngagement / totalPosts / followersCount) * 10000) / 100
      : 0

    const base64Picture = profile.profile_image_url
      ? await fetchedImageBase64(profile.profile_image_url)
      : undefined;

    return {
      platform: 'twitter',
      accountId: profile.id,
      username: profile.username || socialMediaAccount.accountName || '',
      picture: base64Picture,
      fetchedAt: new Date().toISOString(),
      followers: followersCount,
      following: profile.public_metrics?.following_count,
      posts: profile.public_metrics?.tweet_count,
      engagement: {
        total: totalEngagement,
        likes: totalLikes,
        comments: totalReplies,
        shares: totalRetweets + totalQuotes,
        impressions: totalEngagement,
      },
      growth: {
        followers: { absolute: 0, percentage: 0 },
        following: { absolute: 0, percentage: 0 },
        posts: { absolute: 0, percentage: 0 },
        engagement: { absolute: totalEngagement, percentage: engagementRate },
      },
      extra: {
        name: profile.name,
        totalRetweets,
        totalQuotes,
        totalReplies,
        engagementRate,
        topTweets,
        topTweetsCount: topTweets.length,
        listedCount: profile.public_metrics?.listed_count,
      },
    }
  }

  override async addComment(
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      if (!postDetails.postId) {
        throw new Error('Tweet ID is required for replying');
      }

      const accessToken = socialMediaAccount.accessToken;

      const client = new TwitterApi(accessToken);

      const reply = await client.v2.reply(commentDetails.content, postDetails.postId);

      const commentResponse: PostResponse = {
        id: commentDetails.id,
        postId: reply.data.id,
        releaseURL: `https://twitter.com/${socialMediaAccount.username}/status/${reply.data.id}`,
        status: 'published',
      };

      this.emit('x:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
      return commentResponse;
    } catch (error: unknown) {
      log.error({ content: 'X comment failed', plugin: 'twitter', error: (error as Error).message });
      this.logPluginEvent('comment-error', 'failure', `Error: ${(error as Error).message}`, commentDetails.id);
      const errorResponse: PostResponse = {
        id: commentDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('x:comment:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  /**
   * Extract tweet ID from postDetails.platformPosts
   */
  private extractTweetId(postDetails: PluginPostDetails, socialMediaAccount: PluginSocialMediaAccount): string | null {
    const platformPost = postDetails.platformPosts?.find(
      (pp) => pp.socialAccountId === socialMediaAccount.id
    );
    if (!platformPost) return null;

    // Parse the publishDetail which is stored as JSON string
    try {
      const detail = JSON.parse(platformPost.publishDetail as unknown as string || '{}');
      return detail.postId || null;
    } catch {
      return null;
    }
  }

  /**
   * Transform Twitter API tweet/reply to PlatformComment format
   */
  private async transformTweetToComment(tweet: {
    id: string;
    text?: string;
    author?: { username?: string; name?: string; id?: string; profile_image_url?: string };
    created_at?: string;
    public_metrics?: { like_count?: number; reply_count?: number };
    conversation_id?: string;
  }): Promise<PlatformComment> {
    const authorPicture = tweet.author?.profile_image_url
      ? await fetchedImageBase64(tweet.author.profile_image_url)
      : undefined;
    return {
      id: tweet.id,
      text: tweet.text || '',
      authorName: tweet.author?.username || tweet.author?.name || 'Unknown',
      authorId: tweet.author?.id,
      authorPicture,
      createdAt: tweet.created_at,
      likeCount: tweet.public_metrics?.like_count,
      replyCount: tweet.public_metrics?.reply_count,
      parentId: tweet.conversation_id !== tweet.id ? tweet.conversation_id : undefined,
    };
  }

  /**
   * Get comments for a tweet
   * Note: Twitter's standard API doesn't expose all replies without elevated access.
   * This implementation returns an empty comments array with a note about API limitations.
   */
  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    const tweetId = this.extractTweetId(postDetails, socialMediaAccount);

    if (!tweetId) {
      return {
        platform: this.pluginName,
        postId: postDetails.id,
        comments: [],
        hasMore: false,
      };
    }

    const accessToken = socialMediaAccount.accessToken;

    try {
      const client = new TwitterApi(accessToken);

      // Try to fetch tweet info with conversation context
      // Twitter API v2 standard doesn't expose all replies without elevated access
      // We can only get the original tweet info
      const tweet = await client.v2.singleTweet(tweetId, {
        'tweet.fields': ['conversation_id', 'created_at', 'public_metrics', 'author_id'],
        expansions: ['author_id'],
        'user.fields': ['name', 'username', 'profile_image_url'],
      });

      // Twitter standard API doesn't return all replies/comments without elevated access
      // Return empty comments array with hasMore: false to indicate API limitation
      return {
        platform: this.pluginName,
        postId: tweetId,
        comments: [],
        hasMore: false,
      };
    } catch (error) {
      log.error({ content: 'Error fetching X comments', plugin: 'twitter', error: (error as Error).message });
      this.logPluginEvent('get-comments', 'failure', `Error: ${(error as Error).message}`);
      // Return empty on error rather than throwing, consistent with Facebook plugin behavior
      return {
        platform: this.pluginName,
        postId: tweetId,
        comments: [],
        hasMore: false,
      };
    }
  }

  /**
   * Reply to a comment (tweet)
   */
  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    const accessToken = socialMediaAccount.accessToken;

    try {
      const client = new TwitterApi(accessToken);

      // commentId here IS the tweet ID to reply to
      const reply = await client.v2.reply(replyText, commentId);

      return {
        success: true,
        comment: await this.transformTweetToComment(reply.data),
      };
    } catch (error) {
      log.error({ content: 'Error replying to X comment', plugin: 'twitter', error: (error as Error).message });
      this.logPluginEvent('reply-comment-error', 'failure', `Error: ${(error as Error).message}`, commentId);
      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to comment',
      };
    }
  }
}
