import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import { TwitterApi } from 'twitter-api-v2';
import sharp from 'sharp';
import { platformConfigurations } from '../../../shared/platformConstants';

export class XPlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'x';
    readonly pluginName = 'x';
    public override exposedMethods = [
        'xMaxLength',
        'getUser',
        'getTweetMetrics',
    ] as const;
    override maxConcurrentJob = platformConfigurations.twitter.maxConcurrentJob; // X has strict rate limits (300 posts per 3 hours)

    xMaxLength(isPremium: boolean = false) {
        return isPremium ? 4000 : 280;
    }

    protected init(options?: any): void {
        console.log('X (Twitter) plugin initialized', options);
    }

    override async validate(post: Post): Promise<string[]> {
        const errors: string[] = [];
        const settings = post.settings as any;
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

                imageBuffer = await sharp(imageBuffer)
                    .resize(width, height)
                    .jpeg({ quality: 85 })
                    .toBuffer();
            }
        }

        return imageBuffer;
    }

    override async post(
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
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

            const tweetOptions: any = {
                text: postDetails.content,
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
                    duration_minutes: settings.poll.duration || 1440, // Default 24 hours
                };
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
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        try {
            // X doesn't support editing tweets
            // Delete and recreate pattern like Bluesky
            if (!postDetails.postId) {
                throw new Error('Tweet ID is required for updating');
            }

            const [accessToken, accessSecret] = socialMediaAccount.accessToken.split(':');

            const client = new TwitterApi({
                appKey: process.env.NUXT_X_API_KEY!,
                appSecret: process.env.NUXT_X_API_SECRET!,
                accessToken,
                accessSecret,
            });

            // Delete old tweet
            await client.v2.deleteTweet(postDetails.postId);

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

    override async addComment(
        postDetails: PostWithAllData,
        commentDetails: PostDetails,
        socialMediaAccount: SocialMediaAccount
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
