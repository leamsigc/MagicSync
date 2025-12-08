import type { PostDetails, PostResponse, Integration, PluginPostDetails, PluginSocialMediaAccount } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import type { RedditSettings } from '../../../shared/platformSettings';

import { platformConfigurations } from '../../../shared/platformConstants';

export class RedditPlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'reddit';
    readonly pluginName = 'reddit';

    private getPlatformData(postDetails: PostWithAllData) {
        const platformName = this.pluginName;
        const platformContent = (postDetails as any).platformContent?.[platformName];
        const platformSettings = (postDetails as any).platformSettings?.[platformName] as RedditSettings | undefined;
        return {
            content: platformContent?.content || postDetails.content,
            settings: platformSettings,
            postFormat: (postDetails as any).postFormat || 'post'
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

    protected init(options?: any): void {
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
    async getSubreddits(accessToken: string): Promise<any[]> {
        const response = await fetch('https://oauth.reddit.com/subreddits/mine/subscriber', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'User-Agent': 'PostScheduler/1.0',
            },
        });
        const data = await response.json();
        return data.data.children.map((child: any) => child.data);
    }

    /**
     * Get authenticated user information
     */
    async getUser(accessToken: string): Promise<any> {
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
        const filename = asset.filename || 'upload';

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
            const settings = postDetails.settings as any;
            const subreddit = settings?.subreddit;

            if (!subreddit) {
                throw new Error('Subreddit is required. Please specify in post settings.');
            }

            const submitData: any = {
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
                    submitData.video_poster_url = videoAsset.url;
                    delete submitData.text;
                } else if (imageAsset) {
                    // Image post
                    submitData.kind = 'image';
                    submitData.url = imageAsset.url;
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
                body: new URLSearchParams(submitData),
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

        const response = await fetch(`https://oauth.reddit.com/api/info?id=${postId}`, {
            headers: {
                Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                'User-Agent': 'PostScheduler/1.0',
            },
        });
        const data = await response.json();
        return data?.data?.children?.[0]?.data || {};
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
}
