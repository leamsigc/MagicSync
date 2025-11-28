import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import { google, youtube_v3 } from 'googleapis';
import { platformConfigurations } from '../../../shared/platformConstants';

export class YouTubePlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'youtube';
    readonly pluginName = 'youtube';
    public override exposedMethods = [
        'getChannels',
        'getVideoCategories',
    ] as const;
    override maxConcurrentJob = platformConfigurations.youtube.maxConcurrentJob; // YouTube has strict upload quotas

    protected init(options?: any): void {
        console.log('YouTube plugin initialized', options);
    }

    override async validate(post: Post): Promise<string[]> {
        const errors: string[] = [];

        if (!post.assets || post.assets.length === 0) {
            errors.push('At least one video is required for YouTube uploads.');
        }

        const hasVideo = post.assets?.some((asset: any) => asset.mimeType?.includes('video'));
        if (!hasVideo) {
            errors.push('YouTube requires a video file.');
        }

        return Promise.resolve(errors);
    }

    /**
     * Get user's YouTube channels
     */
    async getChannels(accessToken: string): Promise<any[]> {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });

        const youtube = google.youtube({ version: 'v3', auth });
        const response = await youtube.channels.list({
            part: ['snippet', 'contentDetails', 'statistics'],
            mine: true,
        });

        return response.data.items || [];
    }

    /**
     * Get available video categories
     */
    async getVideoCategories(regionCode: string, accessToken: string): Promise<any[]> {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });

        const youtube = google.youtube({ version: 'v3', auth });
        const response = await youtube.videoCategories.list({
            part: ['snippet'],
            regionCode: regionCode || 'US',
        });

        return response.data.items || [];
    }

    override async post(
        postDetails: PostWithAllData,
        comments: PostDetails[],
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        try {
            if (!postDetails.assets || postDetails.assets.length === 0) {
                throw new Error('Video file is required for YouTube uploads');
            }

            const videoAsset = postDetails.assets.find((asset: Asset) =>
                asset.mimeType.includes('video')
            );

            if (!videoAsset) {
                throw new Error('No video file found in assets');
            }

            const settings = postDetails.settings as any;

            // Setup OAuth2 client
            const auth = new google.auth.OAuth2();
            auth.setCredentials({ access_token: socialMediaAccount.accessToken });

            const youtube = google.youtube({ version: 'v3', auth });

            // Prepare video metadata
            const videoMetadata: youtube_v3.Schema$Video = {
                snippet: {
                    title: postDetails.title || 'Untitled Video',
                    description: postDetails.content || '',
                    tags: settings?.tags || [],
                    categoryId: settings?.categoryId || '22', // Default: People & Blogs
                },
                status: {
                    privacyStatus: settings?.privacyStatus || 'private', // public, unlisted, private
                    selfDeclaredMadeForKids: settings?.madeForKids || false,
                },
            };

            // Download video
            const videoResponse = await fetch(videoAsset.url);
            const videoBuffer = await videoResponse.arrayBuffer();

            // Upload video
            const uploadResponse = await youtube.videos.insert({
                part: ['snippet', 'status'],
                requestBody: videoMetadata,
                media: {
                    mimeType: 'video/*',
                    body: Buffer.from(videoBuffer),
                },
            });

            const videoId = uploadResponse.data.id;

            if (!videoId) {
                throw new Error('Failed to get video ID from YouTube');
            }

            // Set thumbnail if provided
            if (settings?.thumbnailUrl) {
                const thumbnailResponse = await fetch(settings.thumbnailUrl);
                const thumbnailBuffer = await thumbnailResponse.arrayBuffer();

                await youtube.thumbnails.set({
                    videoId: videoId,
                    media: {
                        mimeType: 'image/jpeg',
                        body: Buffer.from(thumbnailBuffer),
                    },
                });
            }

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId: videoId,
                releaseURL: `https://www.youtube.com/watch?v=${videoId}`,
                status: 'published',
            };

            this.emit('youtube:post:published', { postId: postResponse.postId, response: uploadResponse.data });
            return postResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('youtube:post:failed', { error: (error as Error).message });
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
                throw new Error('Video ID is required for updating');
            }

            const settings = postDetails.settings as any;

            const auth = new google.auth.OAuth2();
            auth.setCredentials({ access_token: socialMediaAccount.accessToken });

            const youtube = google.youtube({ version: 'v3', auth });

            // Update video metadata
            const videoMetadata: youtube_v3.Schema$Video = {
                id: postDetails.postId,
                snippet: {
                    title: postDetails.title || 'Untitled Video',
                    description: postDetails.content || '',
                    tags: settings?.tags || [],
                    categoryId: settings?.categoryId || '22',
                },
            };

            if (settings?.privacyStatus) {
                videoMetadata.status = {
                    privacyStatus: settings.privacyStatus,
                };
            }

            const updateResponse = await youtube.videos.update({
                part: ['snippet', 'status'],
                requestBody: videoMetadata,
            });

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId: postDetails.postId,
                releaseURL: `https://www.youtube.com/watch?v=${postDetails.postId}`,
                status: 'published',
            };

            this.emit('youtube:post:updated', { postId: postResponse.postId, postDetails });
            return postResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('youtube:post:update:failed', { error: (error as Error).message });
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
                throw new Error('Video ID is required for commenting');
            }

            const auth = new google.auth.OAuth2();
            auth.setCredentials({ access_token: socialMediaAccount.accessToken });

            const youtube = google.youtube({ version: 'v3', auth });

            const commentResponse = await youtube.commentThreads.insert({
                part: ['snippet'],
                requestBody: {
                    snippet: {
                        videoId: postDetails.postId,
                        topLevelComment: {
                            snippet: {
                                textOriginal: commentDetails.message,
                            },
                        },
                    },
                },
            });

            const commentId = commentResponse.data.id;

            const commentResult: PostResponse = {
                id: commentDetails.id,
                postId: commentId || '',
                releaseURL: `https://www.youtube.com/watch?v=${postDetails.postId}`,
                status: 'published',
            };

            this.emit('youtube:comment:added', { commentId: commentResult.postId, postDetails, commentDetails });
            return commentResult;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: commentDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('youtube:comment:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }
}
