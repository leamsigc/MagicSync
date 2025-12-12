import type { PostDetails, PostResponse, Integration, PluginPostDetails, PluginSocialMediaAccount } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import { TwitterApi } from 'twitter-api-v2';
import sharp from 'sharp';
import { platformConfigurations } from '../../../shared/platformConstants';
import type { TwitterSettings } from '../../../shared/platformSettings';

export class XPlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'x';
    readonly pluginName = 'x';
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
    async getUser(accessToken: string, accessSecret: string): Promise<any> {
        const client = new TwitterApi({
            appKey: process.env.NUXT_X_API_KEY!,
            appSecret: process.env.NUXT_X_API_SECRET!,
            accessToken,
            accessSecret,
        });

        const user = await client.v2.me();
        return user.data;
    }

    /**
     * Get tweet metrics
     */
    async getTweetMetrics(tweetId: string, accessToken: string, accessSecret: string): Promise<any> {
        const client = new TwitterApi({
            appKey: process.env.NUXT_X_API_KEY!,
            appSecret: process.env.NUXT_X_API_SECRET!,
            accessToken,
            accessSecret,
        });

        const tweet = await client.v2.singleTweet(tweetId, {
            'tweet.fields': ['public_metrics', 'created_at'],
        });

        return tweet.data;
    }

    /**
     * Process and optimize image for X
     */
    private async processImage(asset: Asset): Promise<Buffer> {
        const response = await fetch(asset.url);
        const arrayBuffer = await response.arrayBuffer();
        let imageBuffer = Buffer.from(arrayBuffer);

        // X image requirements: max 5MB
        const maxSize = 5 * 1024 * 1024;

        if (imageBuffer.length > maxSize) {
            // Resize and compress
            const metadata = await sharp(imageBuffer).metadata();
            let width = metadata.width!;
            let height = metadata.height!;

            while (imageBuffer.length > maxSize && width > 100) {
                width = Math.floor(width * 0.9);
                height = Math.floor(height * 0.9);

                imageBuffer = await sharp(imageBuffer as unknown as Buffer)
                    .resize(width, height)
                    .jpeg({ quality: 85 })
                    .toBuffer();
            }
        }

        return imageBuffer;
    }

    override async post(
        postDetails: PluginPostDetails,
        comments: PluginPostDetails[],
        socialMediaAccount: PluginSocialMediaAccount
    ): Promise<PostResponse> {
        try {
            // X stores token as "accessToken:accessSecret"
            const [accessToken, accessSecret] = socialMediaAccount.accessToken.split(':');

            if (!accessToken || !accessSecret) {
                throw new Error('Invalid X authentication tokens');
            }

            const client = new TwitterApi({
                appKey: process.env.NUXT_X_API_KEY!,
                appSecret: process.env.NUXT_X_API_SECRET!,
                accessToken,
                accessSecret,
            });

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
                    const videoResponse = await fetch(videoAsset.url);
                    const videoBuffer = await videoResponse.arrayBuffer();

                    const mediaId = await client.v1.uploadMedia(Buffer.from(videoBuffer), {
                        mimeType: videoAsset.mimeType,
                    });

                    mediaIds.push(mediaId);
                } else if (imageAssets.length > 0) {
                    // Upload images
                    for (const asset of imageAssets) {
                        const imageBuffer = await this.processImage(asset);
                        const mediaId = await client.v1.uploadMedia(imageBuffer, {
                            mimeType: 'image/jpeg',
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

            const tweet = await client.v2.tweet(tweetOptions);

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId: tweet.data.id,
                releaseURL: `https://twitter.com/${socialMediaAccount.username}/status/${tweet.data.id}`,
                status: 'published',
            };

            this.emit('x:post:published', { postId: postResponse.postId, response: tweet.data });
            return postResponse;
        } catch (error: unknown) {
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

            const [accessToken, accessSecret] = socialMediaAccount.accessToken.split(':');

            const client = new TwitterApi({
                appKey: process.env.NUXT_X_API_KEY!,
                appSecret: process.env.NUXT_X_API_SECRET!,
                accessToken,
                accessSecret,
            });

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

        const [accessToken, accessSecret] = socialMediaAccount.accessToken.split(':');
        return this.getTweetMetrics(postId, accessToken, accessSecret);
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

            const [accessToken, accessSecret] = socialMediaAccount.accessToken.split(':');

            const client = new TwitterApi({
                appKey: process.env.NUXT_X_API_KEY!,
                appSecret: process.env.NUXT_X_API_SECRET!,
                accessToken,
                accessSecret,
            });

            const reply = await client.v2.reply(commentDetails.message, postDetails.postId);

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
