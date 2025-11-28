import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';

import { platformConfigurations } from '../../../shared/platformConstants';

export class ThreadsPlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'threads';
    readonly pluginName = 'threads';
    public override exposedMethods = [
        'threadsMaxLength',
        'getProfile',
        'getPublishingLimit',
    ] as const;
    override maxConcurrentJob = platformConfigurations.threads.maxConcurrentJob;

    threadsMaxLength() {
        return platformConfigurations.threads.maxPostLength;
    }

    protected init(options?: any): void {
        console.log('Threads plugin initialized', options);
    }

    override async validate(post: Post): Promise<string[]> {
        const errors: string[] = [];
        if (!post.content || post.content.trim() === '') {
            errors.push('Thread content cannot be empty.');
        }
        if (post.content && post.content.length > platformConfigurations.threads.maxPostLength) {
            errors.push(`Post content is too long (max ${platformConfigurations.threads.maxPostLength} characters)`);
        }
        return Promise.resolve(errors);
    }

    /**
     * Get Threads user profile
     */
    async getProfile(userId: string, accessToken: string): Promise<any> {
        const response = await fetch(
            `https://graph.threads.net/${userId}?fields=id,username,threads_profile_picture_url,threads_biography&access_token=${accessToken}`
        );
        return response.json();
    }

    /**
     * Create thread container (step 1)
     */
    private async createThreadContainer(
        userId: string,
        mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'CAROUSEL',
        text: string,
        accessToken: string,
        mediaUrl?: string,
        children?: string[]
    ): Promise<string> {
        const params: any = {
            media_type: mediaType,
            text: text,
            access_token: accessToken,
        };

        if (mediaType === 'CAROUSEL' && children) {
            params.children = children.join(',');
        } else if (mediaType === 'IMAGE' && mediaUrl) {
            params.image_url = mediaUrl;
        } else if (mediaType === 'VIDEO' && mediaUrl) {
            params.video_url = mediaUrl;
        }

        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(
            `https://graph.threads.net/${userId}/threads?${queryString}`,
            { method: 'POST' }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Threads container creation failed: ${error}`);
        }

        const data = await response.json();
        return data.id;
    }

    /**
     * Publish thread container (step 2)
     */
    private async publishThreadContainer(
        userId: string,
        creationId: string,
        accessToken: string
    ): Promise<any> {
        const params = new URLSearchParams({
            creation_id: creationId,
            access_token: accessToken,
        });

        // Wait 30 seconds for processing as recommended
        await new Promise(resolve => setTimeout(resolve, 30000));

        const response = await fetch(
            `https://graph.threads.net/${userId}/threads_publish?${params.toString()}`,
            { method: 'POST' }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Threads publish failed: ${error}`);
        }

        return response.json();
    }

    override async post(
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        try {
            const userId = socialMediaAccount.metadata?.threadsUserId || socialMediaAccount.accountId;

            if (!userId) {
                throw new Error('Threads user ID is required');
            }

            const text = postDetails.content;
            let containerId: string;

            if (postDetails.assets && postDetails.assets.length > 1) {
                // Carousel post
                const childContainers: string[] = [];

                for (const asset of postDetails.assets.slice(0, 10)) {
                    let mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE';
                    if (asset.mimeType.includes('video')) {
                        mediaType = 'VIDEO';
                    }

                    const childId = await this.createThreadContainer(
                        userId,
                        mediaType,
                        '',
                        socialMediaAccount.accessToken,
                        asset.url
                    );
                    childContainers.push(childId);
                }

                containerId = await this.createThreadContainer(
                    userId,
                    'CAROUSEL',
                    text,
                    socialMediaAccount.accessToken,
                    undefined,
                    childContainers
                );
            } else if (postDetails.assets && postDetails.assets.length === 1) {
                // Single media post
                const asset = postDetails.assets[0];
                let mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE';
                if (asset.mimeType.includes('video')) {
                    mediaType = 'VIDEO';
                }

                containerId = await this.createThreadContainer(
                    userId,
                    mediaType,
                    text,
                    socialMediaAccount.accessToken,
                    asset.url
                );
            } else {
                // Text-only post
                containerId = await this.createThreadContainer(
                    userId,
                    'TEXT',
                    text,
                    socialMediaAccount.accessToken
                );
            }

            // Publish the container
            const publishedData = await this.publishThreadContainer(
                userId,
                containerId,
                socialMediaAccount.accessToken
            );

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId: publishedData.id,
                releaseURL: `https://www.threads.net/@${socialMediaAccount.username}/post/${publishedData.id}`,
                status: 'published',
            };

            this.emit('threads:post:published', { postId: postResponse.postId, response: publishedData });
            return postResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('threads:post:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }

    override async update(
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        // Threads does not support editing posts
        const errorResponse: PostResponse = {
            id: postDetails.id,
            postId: postDetails.postId || '',
            releaseURL: '',
            status: 'failed',
            error: 'Threads does not support editing posts via API.',
        };
        this.emit('threads:post:update:failed', {
            error: 'Threads API does not support post editing'
        });
        return Promise.resolve(errorResponse);
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

            const userId = socialMediaAccount.metadata?.threadsUserId || socialMediaAccount.accountId;

            // Create reply container
            const params = new URLSearchParams({
                media_type: 'TEXT',
                text: commentDetails.message,
                reply_to_id: postDetails.postId,
                access_token: socialMediaAccount.accessToken,
            });

            const createResponse = await fetch(
                `https://graph.threads.net/${userId}/threads?${params.toString()}`,
                { method: 'POST' }
            );

            if (!createResponse.ok) {
                const error = await createResponse.text();
                throw new Error(`Threads reply creation failed: ${error}`);
            }

            const createData = await createResponse.json();

            // Publish reply
            const publishData = await this.publishThreadContainer(
                userId,
                createData.id,
                socialMediaAccount.accessToken
            );

            const commentResponse: PostResponse = {
                id: commentDetails.id,
                postId: publishData.id,
                releaseURL: `https://www.threads.net/@${socialMediaAccount.username}/post/${publishData.id}`,
                status: 'published',
            };

            this.emit('threads:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
            return commentResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: commentDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('threads:comment:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }
}
