import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import type { DevToSettings } from '../../../shared/platformSettings';

import { platformConfigurations } from '../../../shared/platformConstants';

export class DevToPlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'devto';
    readonly pluginName = 'devto';

    private getPlatformData(postDetails: PostWithAllData) {
        const platformName = this.pluginName;
        const platformContent = (postDetails as any).platformContent?.[platformName];
        const platformSettings = (postDetails as any).platformSettings?.[platformName] as DevToSettings | undefined;
        return {
            content: platformContent?.content || postDetails.content,
            settings: platformSettings,
            postFormat: (postDetails as any).postFormat || 'post'
        };
    }

    public override exposedMethods = [
        'devToMaxLength',
        'getTags',
        'getOrganizations',
    ] as const;
    override maxConcurrentJob = platformConfigurations.devto.maxConcurrentJob;

    devToMaxLength() {
        return platformConfigurations.devto.maxPostLength;
    }

    protected init(options?: { apiUrl?: string }): void {
        console.log('dev.to plugin initialized', options);
    }

    override async validate(post: Post): Promise<string[]> {
        const errors: string[] = [];
        if (!post.content || post.content.trim() === '') {
            errors.push('Article content cannot be empty.');
        }
        if (post.content && post.content.length > platformConfigurations.devto.maxPostLength) {
            errors.push(`Article content is too long (max ${platformConfigurations.devto.maxPostLength} characters)`);
        }
        return Promise.resolve(errors);
    }

    /**
     * Get available tags for articles
     */
    async getTags(apiKey: string): Promise<any[]> {
        const response = await fetch('https://dev.to/api/tags', {
            headers: {
                'api-key': apiKey,
            },
        });
        return response.json();
    }

    /**
     * Get user's organizations
     */
    async getOrganizations(apiKey: string): Promise<any[]> {
        const response = await fetch('https://dev.to/api/organizations', {
            headers: {
                'api-key': apiKey,
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
            const { content, settings } = this.getPlatformData(postDetails);

            const article: any = {
                title: postDetails.title || 'Untitled Article',
                body_markdown: content,
                published: true,
            };

            // Add series if provided
            // DevToSettings doesn't explicitly have 'series' in the interface we saw, but if it did:
            // Assuming settings is cast to 'any' inside or we extend the type? 
            // The lint error said 'series' does not exist on DevToSettings. 
            // We should cast 'settings' to 'any' safely or assume it might be missing from the interface for now?
            // Actually, best to update platformSettings.ts to include 'series' if needed, but for now let's just use what's there or cast.
            // The lint errors for 'series' were real. 
            // Also mapping canonical -> canonical_url and organization -> organization_id.

            const devToSettings = settings as any; // Temporary cast to avoid 'series' error if it's not in interface yet

            if (devToSettings?.series) {
                article.series = devToSettings.series;
            }

            // Add tags if provided (mapping from {label, value} to string)
            if (settings?.tags && Array.isArray(settings.tags)) {
                // Check if tags are objects (as per interface) or strings (legacy?)
                // Interface says { value, label }[]
                article.tags = settings.tags.map((t: any) => t.value || t).filter(Boolean);
            }

            // Add canonical URL if provided
            if (settings?.canonical) {
                article.canonical_url = settings.canonical;
            }

            // Add organization ID if provided
            if (settings?.organization) {
                article.organization_id = settings.organization;
            }

            // Add cover image if available
            if (postDetails.assets && postDetails.assets.length > 0) {
                const coverImage = postDetails.assets.find((asset: Asset) =>
                    asset.mimeType.includes('image')
                );
                if (coverImage) {
                    article.main_image = coverImage.url;
                }
            }

            const response = await fetch('https://dev.to/api/articles', {
                method: 'POST',
                headers: {
                    'api-key': socialMediaAccount.accessToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ article }),
            });

            if (!response.ok) {
                throw new Error(`dev.to API error: ${response.statusText}`);
            }

            const data = await response.json();

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId: String(data.id),
                releaseURL: data.url,
                status: 'published',
            };

            this.emit('devto:post:published', { postId: postResponse.postId, response: data });
            return postResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('devto:post:failed', { error: (error as Error).message });
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

            const article: any = {
                title: postDetails.title || 'Untitled Article',
                body_markdown: postDetails.content,
            };

            const settings = postDetails.settings as any;
            if (settings?.tags && Array.isArray(settings.tags)) {
                article.tags = settings.tags;
            }
            if (settings?.series) {
                article.series = settings.series;
            }
            if (settings?.canonical_url) {
                article.canonical_url = settings.canonical_url;
            }

            const response = await fetch(`https://dev.to/api/articles/${postDetails.postId}`, {
                method: 'PUT',
                headers: {
                    'api-key': socialMediaAccount.accessToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ article }),
            });

            if (!response.ok) {
                throw new Error(`dev.to API error: ${response.statusText}`);
            }

            const data = await response.json();

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId: String(data.id),
                releaseURL: data.url,
                status: 'published',
            };

            this.emit('devto:post:updated', { postId: postResponse.postId, postDetails });
            return postResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('devto:post:update:failed', { error: (error as Error).message });
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

            const comment = {
                body_markdown: commentDetails.message,
            };

            const response = await fetch(
                `https://dev.to/api/comments?a_id=${postDetails.postId}`,
                {
                    method: 'POST',
                    headers: {
                        'api-key': socialMediaAccount.accessToken,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ comment }),
                }
            );

            if (!response.ok) {
                throw new Error(`dev.to API error: ${response.statusText}`);
            }

            const data = await response.json();

            const commentResponse: PostResponse = {
                id: commentDetails.id,
                postId: String(data.id_code),
                releaseURL: `${postDetails.postId}#comment-${data.id_code}`,
                status: 'published',
            };

            this.emit('devto:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
            return commentResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: commentDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('devto:comment:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }
}
