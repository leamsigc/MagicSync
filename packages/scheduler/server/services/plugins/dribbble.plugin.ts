import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import sharp from 'sharp';

import { platformConfigurations } from '../../../shared/platformConstants';

export class DribbblePlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'dribbble';
    readonly pluginName = 'dribbble';
    public override exposedMethods = [
        'dribbbleMaxLength',
        'getUser',
    ] as const;
    override maxConcurrentJob = platformConfigurations.dribbble.maxConcurrentJob;

    dribbbleMaxLength() {
        return platformConfigurations.dribbble.maxPostLength;
    }

    protected init(options?: any): void {
        console.log('Dribbble plugin initialized', options);
    }

    override async validate(post: Post): Promise<string[]> {
        const errors: string[] = [];

        if (!post.content || post.content.trim() === '') {
            errors.push('Shot title cannot be empty.');
        }

        if (!post.assets || post.assets.length === 0) {
            errors.push('At least one image is required for Dribbble shots.');
        }

        return Promise.resolve(errors);
    }

    /**
     * Get authorized user information
     */
    async getUser(accessToken: string): Promise<any> {
        const response = await fetch('https://api.dribbble.com/v2/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return response.json();
    }

    /**
     * Process and validate shot image
     */
    private async processImage(asset: Asset): Promise<{ buffer: Buffer; width: number; height: number }> {
        try {
            const response = await fetch(asset.url);
            const arrayBuffer = await response.arrayBuffer();
            let imageBuffer = Buffer.from(arrayBuffer);

            const metadata = await sharp(imageBuffer).metadata();
            let width = metadata.width!;
            let height = metadata.height!;

            // Dribbble requires exactly 400x300 or 800x600
            // We'll resize to 800x600 if image doesn't match
            if ((width !== 400 || height !== 300) && (width !== 800 || height !== 600)) {
                imageBuffer = await sharp(imageBuffer)
                    .resize(800, 600, { fit: 'cover' })
                    .toBuffer();
                width = 800;
                height = 600;
            }

            // Ensure max size of 8MB
            if (imageBuffer.length > 8 * 1024 * 1024) {
                // Reduce quality iteratively
                let quality = 90;
                while (imageBuffer.length > 8 * 1024 * 1024 && quality > 10) {
                    imageBuffer = await sharp(imageBuffer)
                        .jpeg({ quality })
                        .toBuffer();
                    quality -= 10;
                }

                if (imageBuffer.length > 8 * 1024 * 1024) {
                    throw new Error('Image too large even after compression (max 8MB)');
                }
            }

            return { buffer: imageBuffer, width, height };
        } catch (error) {
            throw new Error(`Failed to process image: ${(error as Error).message}`);
        }
    }

    override async post(
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        try {
            if (!postDetails.assets || postDetails.assets.length === 0) {
                throw new Error('At least one image is required for Dribbble shots');
            }

            const imageAsset = postDetails.assets.find((asset: Asset) =>
                asset.mimeType.includes('image')
            );

            if (!imageAsset) {
                throw new Error('No valid image found in assets');
            }

            // Process the image
            const { buffer } = await this.processImage(imageAsset);

            // Prepare form data
            const formData = new FormData();
            formData.append('image', new Blob([buffer], { type: imageAsset.mimeType }), imageAsset.filename);
            formData.append('title', postDetails.title || postDetails.content.substring(0, 100));

            if (postDetails.content) {
                formData.append('description', postDetails.content);
            }

            const settings = postDetails.settings as any;

            // Add tags if provided (max 12)
            if (settings?.tags && Array.isArray(settings.tags)) {
                const tags = settings.tags.slice(0, 12);
                tags.forEach((tag: string) => formData.append('tags[]', tag));
            }

            // Add low_profile flag if provided
            if (settings?.low_profile) {
                formData.append('low_profile', 'true');
            }

            // Add rebound source if provided
            if (settings?.rebound_source_id) {
                formData.append('rebound_source_id', settings.rebound_source_id);
            }

            // Add team ID if provided
            if (settings?.team_id) {
                formData.append('team_id', settings.team_id);
            }

            // Add scheduled time if provided (ISO 8601 format)
            if (settings?.scheduled_for) {
                formData.append('scheduled_for', settings.scheduled_for);
            }

            const response = await fetch('https://api.dribbble.com/v2/shots', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Dribbble API error: ${error}`);
            }

            const data = await response.json();

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId: String(data.id),
                releaseURL: data.html_url,
                status: 'published',
            };

            this.emit('dribbble:post:published', { postId: postResponse.postId, response: data });
            return postResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('dribbble:post:failed', { error: (error as Error).message });
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
                throw new Error('Shot ID is required for updating');
            }

            // Dribbble API v2 supports updating shots
            const updateData: any = {};

            if (postDetails.title) {
                updateData.title = postDetails.title;
            }

            if (postDetails.content) {
                updateData.description = postDetails.content;
            }

            const settings = postDetails.settings as any;
            if (settings?.tags && Array.isArray(settings.tags)) {
                updateData.tags = settings.tags.slice(0, 12);
            }

            const response = await fetch(
                `https://api.dribbble.com/v2/shots/${postDetails.postId}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updateData),
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Dribbble API error: ${error}`);
            }

            const data = await response.json();

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId: String(data.id),
                releaseURL: data.html_url,
                status: 'published',
            };

            this.emit('dribbble:post:updated', { postId: postResponse.postId, postDetails });
            return postResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('dribbble:post:update:failed', { error: (error as Error).message });
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
                throw new Error('Shot ID is required for commenting');
            }

            const response = await fetch(
                `https://api.dribbble.com/v2/shots/${postDetails.postId}/comments`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        body: commentDetails.message,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Dribbble API error: ${error}`);
            }

            const data = await response.json();

            const commentResponse: PostResponse = {
                id: commentDetails.id,
                postId: String(data.id),
                releaseURL: `${postDetails.postId}#comment-${data.id}`,
                status: 'published',
            };

            this.emit('dribbble:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
            return commentResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: commentDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('dribbble:comment:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }
}
