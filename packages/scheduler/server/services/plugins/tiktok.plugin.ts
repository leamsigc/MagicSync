import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';

import { platformConfigurations } from '../../../shared/platformConstants';

export class TikTokPlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'tiktok';
    readonly pluginName = 'tiktok';
    public override exposedMethods = [
        'tiktokMaxLength',
        'getUser',
        'getVideoInfo',
    ] as const;
    override maxConcurrentJob = platformConfigurations.tiktok.maxConcurrentJob;

    tiktokMaxLength() {
        return platformConfigurations.tiktok.maxPostLength;
    }
    protected init(options?: any): void {
        console.log('TikTok plugin initialized', options);
    }

    override async validate(post: Post): Promise<string[]> {
        const errors: string[] = [];

        if (post.content && post.content.length > platformConfigurations.tiktok.maxPostLength) {
            errors.push(`Caption is too long (max ${platformConfigurations.tiktok.maxPostLength} characters)`);
        }
        if (!post.assets || post.assets.length === 0) {
            errors.push('At least one video is required for TikTok posts.');
        }

        const hasVideo = post.assets?.some((asset: any) => asset.mimeType?.includes('video'));
        if (!hasVideo) {
            errors.push('TikTok requires a video file (MP4 + H.264).');
        }

        return Promise.resolve(errors);
    }

    /**
     * Get authenticated user information
     */
    async getUser(accessToken: string): Promise<any> {
        const response = await fetch(
            'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.json();
    }

    /**
     * Get video information
     */
    async getVideoInfo(videoId: string, accessToken: string): Promise<any> {
        const response = await fetch(
            `https://open.tiktokapis.com/v2/video/query/?fields=id,create_time,cover_image_url,duration,height,width,title,video_description`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filters: {
                        video_ids: [videoId],
                    },
                }),
            }
        );
        return response.json();
    }

    override async post(
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        try {
            if (!postDetails.assets || postDetails.assets.length === 0) {
                throw new Error('Video file is required for TikTok posts');
            }

            const videoAsset = postDetails.assets.find((asset: Asset) =>
                asset.mimeType.includes('video')
            );

            if (!videoAsset) {
                throw new Error('No video file found in assets');
            }

            const settings = postDetails.settings as any;

            // Step 1: Initialize video upload
            const initData: any = {
                post_info: {
                    title: postDetails.title || '',
                    privacy_level: settings?.privacy_level || 'SELF_ONLY', // PUBLIC, FRIENDS_ONLY, SELF_ONLY
                    disable_duet: settings?.disable_duet || false,
                    disable_comment: settings?.disable_comment || false,
                    disable_stitch: settings?.disable_stitch || false,
                    video_cover_timestamp_ms: settings?.video_cover_timestamp_ms || 0,
                },
                source_info: {
                    source: 'FILE_UPLOAD',
                    video_size: videoAsset.size || 0,
                    chunk_size: 10485760, // 10MB chunks
                    total_chunk_count: Math.ceil((videoAsset.size || 0) / 10485760),
                },
            };

            const initResponse = await fetch(
                'https://open.tiktokapis.com/v2/post/publish/video/init/',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(initData),
                }
            );

            if (!initResponse.ok) {
                const error = await initResponse.text();
                throw new Error(`TikTok init failed: ${error}`);
            }

            const initResult = await initResponse.json();
            const publishId = initResult.data.publish_id;
            const uploadUrl = initResult.data.upload_url;

            // Step 2: Upload video file
            const videoResponse = await fetch(videoAsset.url);
            const videoBlob = await videoResponse.blob();

            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'video/mp4',
                    'Content-Length': String(videoBlob.size),
                },
                body: videoBlob,
            });

            if (!uploadResponse.ok) {
                throw new Error('Video upload to TikTok failed');
            }

            // Step 3: Check upload status and finalize
            let uploadComplete = false;
            let attempts = 0;
            const maxAttempts = 30;

            while (!uploadComplete && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

                const statusResponse = await fetch(
                    `https://open.tiktokapis.com/v2/post/publish/status/${publishId}/`,
                    {
                        headers: {
                            Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                        },
                    }
                );

                const statusData = await statusResponse.json();

                if (statusData.data.status === 'PUBLISH_COMPLETE') {
                    uploadComplete = true;
                } else if (statusData.data.status === 'FAILED') {
                    throw new Error(`TikTok upload failed: ${statusData.data.fail_reason}`);
                }

                attempts++;
            }

            if (!uploadComplete) {
                throw new Error('TikTok upload timeout');
            }

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId: publishId,
                releaseURL: `https://www.tiktok.com/@${socialMediaAccount.username}/video/${publishId}`,
                status: 'published',
            };

            this.emit('tiktok:post:published', { postId: postResponse.postId });
            return postResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('tiktok:post:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }

    override async update(
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        // TikTok does not support editing videos
        const errorResponse: PostResponse = {
            id: postDetails.id,
            postId: postDetails.postId || '',
            releaseURL: '',
            status: 'failed',
            error: 'TikTok does not support editing videos via API.',
        };
        this.emit('tiktok:post:update:failed', {
            error: 'TikTok API does not support video editing'
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
                throw new Error('Video ID is required for commenting');
            }

            const response = await fetch(
                'https://open.tiktokapis.com/v2/comment/publish/',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        video_id: postDetails.postId,
                        text: commentDetails.message,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`TikTok comment failed: ${error}`);
            }

            const data = await response.json();

            const commentResponse: PostResponse = {
                id: commentDetails.id,
                postId: data.data.comment_id,
                releaseURL: postDetails.releaseURL || '',
                status: 'published',
            };

            this.emit('tiktok:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
            return commentResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: commentDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('tiktok:comment:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }
}
