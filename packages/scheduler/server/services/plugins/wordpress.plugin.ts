import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';

import { platformConfigurations } from '../../../shared/platformConstants';

export class WordPressPlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'wordpress';
    readonly pluginName = 'wordpress';
    public override exposedMethods = [
        'wordPressMaxLength',
        'getCategories',
        'getTags',
    ] as const;
    override maxConcurrentJob = platformConfigurations.wordpress.maxConcurrentJob;

    wordPressMaxLength() {
        return platformConfigurations.wordpress.maxPostLength;
    }

    protected init(options?: any): void {
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
    async getCategories(siteUrl: string, accessToken: string): Promise<any[]> {
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
    async getTags(siteUrl: string, accessToken: string): Promise<any[]> {
        const response = await fetch(`${siteUrl}/wp-json/wp/v2/tags`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return response.json();
    }

    override async post(
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        try {
            const siteUrl = socialMediaAccount.metadata?.siteUrl;

            if (!siteUrl) {
                throw new Error('WordPress site URL is required in account settings');
            }

            const settings = postDetails.settings as any;

            const postData: any = {
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
        postDetails: PostWithAllData,
        comments: PostDetails[],
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

            const settings = postDetails.settings as any;

            const postData: any = {
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
        postDetails: PostWithAllData,
        commentDetails: PostDetails,
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
                content: commentDetails.message,
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
}
