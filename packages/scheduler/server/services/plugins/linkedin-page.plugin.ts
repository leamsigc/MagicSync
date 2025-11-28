import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import { BaseSchedulerPlugin } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import sharp from 'sharp';

/**
 * LinkedIn Page Plugin - Posts on behalf of LinkedIn Organization/Company pages
 * Requires w_organization_social scope and organization admin/content admin role
 */
import { platformConfigurations } from '../../../shared/platformConstants';

export class LinkedInPagePlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'linkedin-page';
    readonly pluginName = 'linkedin-page';
    public override exposedMethods = [
        'linkedInMaxLength',
        'getOrganizations',
    ] as const;
    override maxConcurrentJob = platformConfigurations['linkedin-page'].maxConcurrentJob;

    linkedInMaxLength() {
        return platformConfigurations['linkedin-page'].maxPostLength;
    }

    protected init(options?: any): void {
        console.log('LinkedIn Page plugin initialized', options);
    }

    override async validate(post: Post): Promise<string[]> {
        const errors: string[] = [];

        if (!post.content || post.content.trim() === '') {
            errors.push('Post content cannot be empty.');
        }

        if (post.content && post.content.length > platformConfigurations['linkedin-page'].maxPostLength) {
            errors.push(`Post content is too long (max ${platformConfigurations['linkedin-page'].maxPostLength} characters)`);
        }

        return Promise.resolve(errors);
    }

    /**
     * Get organization information
     */
    async getOrganization(organizationId: string, accessToken: string): Promise<any> {
        const response = await fetch(
            `https://api.linkedin.com/v2/organizations/${organizationId}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'LinkedIn-Version': '202401',
                },
            }
        );
        return response.json();
    }

    /**
     * Upload image to LinkedIn (same as personal profile)
     */
    private async uploadImage(organizationUrn: string, imageBuffer: Buffer, accessToken: string): Promise<string> {
        // Step 1: Register upload
        const registerResponse = await fetch(
            'https://api.linkedin.com/v2/assets?action=registerUpload',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'LinkedIn-Version': '202401',
                },
                body: JSON.stringify({
                    registerUploadRequest: {
                        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                        owner: organizationUrn,
                        serviceRelationships: [
                            {
                                relationshipType: 'OWNER',
                                identifier: 'urn:li:userGeneratedContent',
                            },
                        ],
                    },
                }),
            }
        );

        const registerData = await registerResponse.json();
        const uploadUrl = registerData.value.uploadMechanism[
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
        ].uploadUrl;
        const asset = registerData.value.asset;

        // Step 2: Upload the image
        await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            body: imageBuffer as unknown as BodyInit,
        });

        return asset;
    }

    override async post(
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        try {
            // Organization URN format: urn:li:organization:{organization_id}
            const organizationUrn = socialMediaAccount.metadata?.organizationUrn ||
                `urn:li:organization:${socialMediaAccount.accountId}`;

            const postData: any = {
                author: organizationUrn,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text: postDetails.content,
                        },
                        shareMediaCategory: 'NONE',
                    },
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
                },
            };

            // Handle media attachments
            if (postDetails.assets && postDetails.assets.length > 0) {
                const imageAssets = postDetails.assets.filter((asset: Asset) =>
                    asset.mimeType.includes('image')
                );

                if (imageAssets.length > 0) {
                    const media: any[] = [];

                    for (const asset of imageAssets) {
                        const response = await fetch(asset.url);
                        const arrayBuffer = await response.arrayBuffer();
                        const imageBuffer = Buffer.from(arrayBuffer);

                        const assetUrn = await this.uploadImage(organizationUrn, imageBuffer, socialMediaAccount.accessToken);

                        media.push({
                            status: 'READY',
                            description: {
                                text: asset.filename || 'Image',
                            },
                            media: assetUrn,
                            title: {
                                text: asset.filename || 'Image',
                            },
                        });
                    }

                    postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
                    postData.specificContent['com.linkedin.ugc.ShareContent'].media = media;
                }
            }

            const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0',
                    'LinkedIn-Version': '202401',
                },
                body: JSON.stringify(postData),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`LinkedIn Page API error: ${error}`);
            }

            const data = await response.json();
            const postId = data.id;

            // Extract share ID from the URN
            const shareId = postId.replace('urn:li:share:', '').replace('urn:li:ugcPost:', '');

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId,
                releaseURL: `https://www.linkedin.com/feed/update/${shareId}/`,
                status: 'published',
            };

            this.emit('linkedin-page:post:published', { postId: postResponse.postId, response: data });
            return postResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('linkedin-page:post:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }

    override async update(
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        // LinkedIn doesn't support editing posts via API
        const errorResponse: PostResponse = {
            id: postDetails.id,
            postId: postDetails.postId || '',
            releaseURL: '',
            status: 'failed',
            error: 'LinkedIn does not support editing organization posts via API.',
        };
        this.emit('linkedin-page:post:update:failed', {
            error: 'LinkedIn API does not support post editing'
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

            const organizationUrn = socialMediaAccount.metadata?.organizationUrn ||
                `urn:li:organization:${socialMediaAccount.accountId}`;

            const commentData = {
                actor: organizationUrn,
                message: {
                    text: commentDetails.message,
                },
                object: postDetails.postId,
            };

            const response = await fetch('https://api.linkedin.com/v2/socialActions/comments', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0',
                    'LinkedIn-Version': '202401',
                },
                body: JSON.stringify(commentData),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`LinkedIn Page comment failed: ${error}`);
            }

            const data = await response.json();

            const commentResponse: PostResponse = {
                id: commentDetails.id,
                postId: data.id,
                releaseURL: postDetails.releaseURL || '',
                status: 'published',
            };

            this.emit('linkedin-page:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
            return commentResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: commentDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('linkedin-page:comment:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }
}
