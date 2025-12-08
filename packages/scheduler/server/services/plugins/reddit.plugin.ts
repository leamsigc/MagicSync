import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
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
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
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

            submitData.title = finalTitle;
            submitData.kind = settings?.type || 'self'; // self, link, image, video
            // ... (other fields handled below based on kind)

            if (settings?.type === 'link') {
                if (!settings.url) throw new Error('URL required for link post');
                postData.append('url', settings.url);
            } else if (settings?.type === 'self' || !settings?.type) {
                postData.append('text', bodyContent || '');
            }

            if (settings?.subreddit?.flair?.id) {
                postData.append('flair_id', settings.subreddit.flair.id);
            }
            if (settings?.subreddit?.flair?.text) {
                postData.append('flair_text', settings.subreddit.flair.text);
            }

            // Handle Image/Video Upload if kind is image/video
            if (settings?.type === 'image' || settings?.type === 'video') {
                // ... logic for uploadMedia and then submit
                // Actually, uploadMedia returns something to attach? Or we submit directly?
                // Usually step 1: submit link/text, step 2: upload? No, often upload first.
                // Existing code uses uploadMedia.
                if (!postDetails.assets || postDetails.assets.length === 0) throw new Error('Media required for image/video post');
                const asset = postDetails.assets[0];
                const mediaUrl = await this.uploadMedia(subreddit, asset, accessToken);
                postData.append('url', mediaUrl);
                // kind is 'image' or 'video' but endpoint uses 'link' with special URL?
                // Reddit API for media is complex. 'kind' should be 'image' or 'video' usually maps to 'link' pointing to hosted media?
                // Existing implementation `uploadMedia` likely handles AWS upload or similar and returns URL.
                // If `uploadMedia` returns reddit-hosted URL, then `kind` is 'link'? 
                // Or `kind` 'image' exists? Reddit submit endpoint accepts 'sr', 'title', 'kind', 'url'/'text'.
                // If type is 'image', we usually submit as 'link' with URL to image?
                // Actually, `kind` param in `/api/submit` is 'link', 'self', 'image', 'video', 'videogif'?
                // Docs say: kind='link' or 'self'. 'image'/'video' are newer and might differ.
                // Let's assume 'link' for media if uploadMedia returns a URL.
                if (settings.type === 'image' || settings.type === 'video') {
                    postData.set('kind', 'link');
                }
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
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        try {
            if (!postDetails.postId) {
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
                    thing_id: postDetails.postId,
                    text: postDetails.content,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Reddit API error: ${error}`);
            }

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId: postDetails.postId,
                releaseURL: postDetails.releaseURL || '',
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

    override async addComment(
        postDetails: PostWithAllData,
        commentDetails: PostDetails,
        socialMediaAccount: SocialMediaAccount
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
                    text: commentDetails.message,
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
