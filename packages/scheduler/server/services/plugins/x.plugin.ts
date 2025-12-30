import type { PostDetails, PostResponse, Integration, PluginPostDetails, PluginSocialMediaAccount } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset, User } from '#layers/BaseDB/db/schema';
import { TwitterApi } from 'twitter-api-v2';
import { platformConfigurations } from '../../../shared/platformConstants';
import type { TwitterSettings } from '../../../shared/platformSettings';
import { promises as fs } from 'node:fs'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { refreshTwitterToken } from '#layers/BaseConnect/server/utils/socialMedia';

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

  protected init(options?: any): void {
    console.log('X (Twitter) plugin initialized', options);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];
    const settings = (post as any).settings;
    const isPremium = settings?.isPremium || false;
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
  async getUser(accessToken: string): Promise<any> {
    const client = new TwitterApi(accessToken);

    const user = await client.v2.me();
    return user.data;
  }

  override async getAuthUrl(businessId: string, callbackUrl?: string): Promise<{ url: string; state?: string; codeVerifier?: string }> {
    const client = new TwitterApi({
      clientId: process.env.NUXT_TWITTER_CLIENT_ID as string,
      clientSecret: process.env.NUXT_TWITTER_CLIENT_SECRET as string,
    });

    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
      callbackUrl || `${process.env.NUXT_BASE_URL}/api/v1/social-accounts/callback/twitter`,
      { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'] }
    );

    return { url, state, codeVerifier };
  }

  override async handleCallback(queryParams: Record<string, any>, user: User, state?: string, codeVerifier?: string): Promise<any> {
    const code = queryParams.code as string;
    const incomingState = queryParams.state as string;

    if (!code || !incomingState || incomingState !== state || !codeVerifier) {
      throw new Error('Invalid OAuth state or verifier');
    }

    const client = new TwitterApi({
      clientId: process.env.NUXT_TWITTER_CLIENT_ID as string,
      clientSecret: process.env.NUXT_TWITTER_CLIENT_SECRET as string,
    });

    const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: `${process.env.NUXT_BASE_URL}/api/v1/social-accounts/callback/twitter`,
    });

    const twitterClient = new TwitterApi(accessToken);
    const { data: twitterUser } = await twitterClient.v2.me({
      'user.fields': ['profile_image_url', 'name', 'username'],
    });

    return socialMediaAccountService.createOrUpdateAccountFromAuth({
      id: twitterUser.id,
      name: twitterUser.name,
      access_token: accessToken,
      picture: twitterUser.profile_image_url || '',
      username: twitterUser.username,
      user: user,
      platformId: 'twitter',
      refresh_token: refreshToken,
      token_expires_at: expiresIn ? new Date(Date.now() + (expiresIn * 1000)) : undefined,
    });
  }

  /**
   * Get tweet metrics
   */
  async getTweetMetrics(tweetId: string, accessToken: string): Promise<any> {
    const client = new TwitterApi(accessToken);

    const tweet = await client.v2.singleTweet(tweetId, {
      'tweet.fields': ['public_metrics', 'created_at'],
    });

    return tweet.data;
  }

  /**
   * Ensure the social media account has a valid access token
   */
  private async ensureValidToken(socialMediaAccount: PluginSocialMediaAccount): Promise<string> {
    if (socialMediaAccountService.isTokenExpired(socialMediaAccount as SocialMediaAccount)) {
      if (!socialMediaAccount.refreshToken) {
        throw new Error('Twitter token expired and no refresh token available');
      }

      console.log('Refreshing Twitter token for account:', socialMediaAccount.id);
      const refreshed = await refreshTwitterToken(socialMediaAccount.refreshToken);
      await socialMediaAccountService.refreshTokens(socialMediaAccount.id, refreshed);

      // Update the local object
      socialMediaAccount.accessToken = refreshed.accessToken;
      socialMediaAccount.refreshToken = refreshed.refreshToken || socialMediaAccount.refreshToken;
    }
    return socialMediaAccount.accessToken;
  }

  /**
   * Process and optimize image for X
   */
  private async processImage(asset: Asset): Promise<Buffer> {
    const imageUrl = getFileFromAsset(asset);
    const { buffer } = await reduceImageBySize(imageUrl, 5 * 1024); // 5MB = 5120 KB
    return buffer;
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      // Ensure token is valid before proceeding
      const accessToken = await this.ensureValidToken(socialMediaAccount);

      if (!accessToken) {
        throw new Error('Invalid X authentication tokens');
      }

      const client = new TwitterApi(accessToken);

      // Use platform-specific content if available, otherwise use master content
      const platformContent = (postDetails as any).platformContent?.twitter
        || (postDetails as any).platformContent?.x;
      const rawContent = platformContent?.content || postDetails.content;
      const contentToPost = this.normalizeContent(rawContent);

      const tweetOptions: any = {
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
              media_type: asset.mimeType || 'image/jpeg' as any,
            });
            mediaIds.push(mediaId);
          }
        }

        if (mediaIds.length > 0) {
          tweetOptions.media = { media_ids: mediaIds };
        }
      }

      // Add poll if provided
      const settings = postDetails.settings as any;
      if (settings?.poll && settings.poll.options && settings.poll.options.length > 0) {
        tweetOptions.poll = {
          options: settings.poll.options,
          duration_minutes: settings.poll.duration || 1440,
        };
      }

      // Platform-specific settings from platformSettings
      const postPlatformSettings = (postDetails as any).platformSettings as Record<string, TwitterSettings> | undefined;
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

      const postComments = (postDetails.platformContent as Record<string, string[]>).comments ?? [];

      let tweet;
      let isThread = false;
      if (postComments.length > 0) {
        // Create a thread with main content and comments
        const threadTweets = [
          tweetOptions, // Main tweet with media, poll, settings
          ...postComments.map(comment => ({ text: this.normalizeContent(comment) }))
        ];
        tweet = await client.v2.tweetThread(threadTweets);
        isThread = true;
      } else {
        // Single tweet
        tweet = await client.v2.tweet(tweetOptions);
      }

      // Add comment to post

      const tweetData = isThread ? (tweet as any)[0] : tweet;
      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: tweetData.data.id,
        releaseURL: `https://twitter.com/${socialMediaAccount.username}/status/${tweetData.data.id}`,
        status: 'published',
      };

      this.emit('x:post:published', { postId: postResponse.postId, response: tweetData.data });
      return postResponse;
    } catch (error: unknown) {
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

      const accessToken = await this.ensureValidToken(socialMediaAccount);
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

    const accessToken = socialMediaAccount.accessToken;
    if (!accessToken) {
      throw new Error('Access token or access secret not found');
    }
    return this.getTweetMetrics(postId, accessToken);
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

      const accessToken = await this.ensureValidToken(socialMediaAccount);

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
}
