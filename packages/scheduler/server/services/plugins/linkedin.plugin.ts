import type { PostResponse, Integration, PluginPostDetails, PluginSocialMediaAccount } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import sharp from 'sharp';
import type { LinkedInSettings } from '../../../shared/platformSettings';

import { platformConfigurations } from '../../../shared/platformConstants';

export class LinkedInPlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'linkedin';
    readonly pluginName = 'linkedin';

    private getPlatformData(postDetails: PluginPostDetails) {
        const platformName = this.pluginName;
        const platformContent = (postDetails as any).platformContent?.[platformName];
        const platformSettings = (postDetails as any).platformSettings?.[platformName] as LinkedInSettings | undefined;
        return {
            content: platformContent?.content || postDetails.content,
            settings: platformSettings,
            postFormat: (postDetails as any).postFormat || 'post'
        };
    }

    public override exposedMethods = [
        'linkedInMaxLength',
        'getProfile',
    ] as const;
    override maxConcurrentJob = platformConfigurations.linkedin.maxConcurrentJob; // LinkedIn has professional posting limits

    linkedInMaxLength() {
        return platformConfigurations.linkedin.maxPostLength;
    }

    protected init(options?: any): void {
        console.log('LinkedIn plugin initialized', options);
    }

    override async validate(post: Post): Promise<string[]> {
        const errors: string[] = [];

        if (!post.content || post.content.trim() === '') {
            errors.push('Post content cannot be empty.');
        }

        if (post.content && post.content.length > platformConfigurations.linkedin.maxPostLength) {
            errors.push(`Post content is too long (max ${platformConfigurations.linkedin.maxPostLength} characters)`);
        }

        return Promise.resolve(errors);
    }

    /**
     * Get LinkedIn user profile
     */
    async getProfile(accessToken: string): Promise<any> {
        const response = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return response.json();
    }

    /**
     * Upload image to LinkedIn
     */
    private async uploadImage(personUrn: string, imageBuffer: Buffer, accessToken: string): Promise<string> {
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
                        owner: personUrn,
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
            body: imageBuffer as any,
        });

        return asset;
    }

    override async post(
        postDetails: PluginPostDetails,
        comments: PluginPostDetails[],
        socialMediaAccount: PluginSocialMediaAccount
    ): Promise<PostResponse> {
        try {
            const { content } = this.getPlatformData(postDetails);

            // Check for media
            const imageAsset = postDetails.assets?.find(
                (asset) => asset.mimeType.includes('image')
            );

            let mediaUrn = '';

            if (imageAsset) {
                // Fetch image buffer
                const response = await fetch(imageAsset.url);
                const arrayBuffer = await response.arrayBuffer();
                const imageBuffer = Buffer.from(arrayBuffer as ArrayBuffer);

                // Upload image
                mediaUrn = await this.uploadImage(
                    `urn:li:person:${socialMediaAccount.accountId}`,
                    imageBuffer,
                    socialMediaAccount.accessToken
                );
            }

            const shareBody: any = {
                author: `urn:li:person:${socialMediaAccount.accountId}`,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text: content,
                        },
                        shareMediaCategory: mediaUrn ? 'IMAGE' : 'NONE',
                        media: mediaUrn
                            ? [
                                {
                                    status: 'READY',
                                    description: {
                                        text: imageAsset?.filename || 'Image',
                                    },
                                    media: mediaUrn,
                                    title: {
                                        text: imageAsset?.filename || 'Image',
                                    },
                                },
                            ]
                            : [],
                    },
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
                },
            };

            const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0',
                    'LinkedIn-Version': '202401',
                },
                body: JSON.stringify(shareBody),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`LinkedIn API error: ${error}`);
            }

            const data = await response.json();
            const postId = data.id;

            // Extract share ID from the URN
            let shareId = postId;
            if (shareId.includes(':')) {
                const parts = shareId.split(':');
                shareId = parts[parts.length - 1];
            }

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId,
                releaseURL: `https://www.linkedin.com/feed/update/urn:li:activity:${shareId}/`,
                status: 'published',
            };

            this.emit('linkedin:post:published', { postId: postResponse.postId, response: data });
            return postResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('linkedin:post:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }

    override async update(
        postDetails: PluginPostDetails,
        comments: PluginPostDetails[],
        socialMediaAccount: PluginSocialMediaAccount
    ): Promise<PostResponse> {
        const publishedPlatformDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
        if (!publishedPlatformDetails) {
            throw new Error('Published platform details not found');
        }

        const publishedDetails = publishedPlatformDetails.publishDetail ? JSON.parse(publishedPlatformDetails.publishDetail as string) as PostResponse : null;
        if (!publishedDetails) {
            throw new Error('Published details not found');
        }
        const publishedPostId = publishedDetails.postId;

        // LinkedIn textual edit is theoretically possible via UGC API PATCH but complex and often restricted.
        // For now, consistent with previous behavior but using correct ID retrieval.
        // If we wanted to support it, we'd need to PATCH urn:li:ugcPost:...

        throw new Error('LinkedIn does not support editing posts via API. Please delete and recreate the post instead.');
    }

    async getStatistic(
        postDetails: PluginPostDetails,
        socialMediaAccount: PluginSocialMediaAccount
    ): Promise<any> {
        const publishedPlatformDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
        if (!publishedPlatformDetails) {
            throw new Error('Published platform details not found');
        }

        const publishedDetails = publishedPlatformDetails.publishDetail ? JSON.parse(publishedPlatformDetails.publishDetail as string) as PostResponse : null;
        if (!publishedDetails) {
            throw new Error('Published details not found');
        }
        const publishedPostId = publishedDetails.postId;

        const response = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(publishedPostId)}`, {
            headers: {
                Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202401',
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`LinkedIn stats failed: ${error}`);
        }

        return response.json();
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

            const personUrn = socialMediaAccount.metadata?.personUrn ||
                `urn:li:person:${socialMediaAccount.accountId}`;

            const commentData = {
                actor: personUrn,
                message: {
                    text: commentDetails.content,
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
                throw new Error(`LinkedIn comment failed: ${error}`);
            }

            const data = await response.json();

            const commentResponse: PostResponse = {
                id: commentDetails.id,
                postId: data.id,
                releaseURL: postDetails.releaseURL || '',
                status: 'published',
            };

            this.emit('linkedin:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
            return commentResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: commentDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('linkedin:comment:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }
}
