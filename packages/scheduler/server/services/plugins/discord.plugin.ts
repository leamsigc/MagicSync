import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';

import { platformConfigurations } from '../../../shared/platformConstants';

export class DiscordPlugin extends BaseSchedulerPlugin {
    static readonly pluginName = 'discord';
    readonly pluginName = 'discord';
    public override exposedMethods = [
        'discordMaxLength',
        'getGuilds',
        'getChannels',
    ] as const;
    override maxConcurrentJob = platformConfigurations.discord.maxConcurrentJob;

    discordMaxLength() {
        return platformConfigurations.discord.maxPostLength;
    }

    protected init(options?: any): void {
        console.log('Discord plugin initialized', options);
    }

    override async validate(post: Post): Promise<string[]> {
        const errors: string[] = [];
        if (!post.content || post.content.trim() === '') {
            errors.push('Message content cannot be empty.');
        }
        if (post.content && post.content.length > platformConfigurations.discord.maxPostLength) {
            errors.push(`Message content is too long (max ${platformConfigurations.discord.maxPostLength} characters)`);
        }
        return Promise.resolve(errors);
    }

    /**
     * Get user's guilds (servers)
     */
    async getGuilds(accessToken: string): Promise<any[]> {
        const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return response.json();
    }

    /**
     * Get channels for a guild
     */
    async getChannels(guildId: string, accessToken: string): Promise<any[]> {
        const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
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
            const settings = postDetails.settings as any;
            const channelId = settings?.channelId || socialMediaAccount.metadata?.channelId;

            if (!channelId) {
                throw new Error('Channel ID is required. Please configure it in account settings.');
            }

            const messagePayload: any = {
                content: postDetails.content,
            };

            // Add embeds if provided in settings
            if (settings?.embeds && Array.isArray(settings.embeds)) {
                messagePayload.embeds = settings.embeds;
            }

            // Handle file attachments
            if (postDetails.assets && postDetails.assets.length > 0) {
                const formData = new FormData();
                formData.append('payload_json', JSON.stringify(messagePayload));

                // Upload files
                for (let i = 0; i < Math.min(postDetails.assets.length, 10); i++) {
                    const asset = postDetails.assets[i];
                    const fileResponse = await fetch(asset.url);
                    const fileBlob = await fileResponse.blob();
                    formData.append(`files[${i}]`, fileBlob, asset.filename);
                }

                const response = await fetch(
                    `https://discord.com/api/v10/channels/${channelId}/messages`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                        },
                        body: formData,
                    }
                );

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`Discord API error: ${error}`);
                }

                const data = await response.json();

                const postResponse: PostResponse = {
                    id: postDetails.id,
                    postId: data.id,
                    releaseURL: `https://discord.com/channels/${data.guild_id || '@me'}/${channelId}/${data.id}`,
                    status: 'published',
                };

                this.emit('discord:post:published', { postId: postResponse.postId, response: data });
                return postResponse;
            } else {
                // Send text-only message
                const response = await fetch(
                    `https://discord.com/api/v10/channels/${channelId}/messages`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(messagePayload),
                    }
                );

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`Discord API error: ${error}`);
                }

                const data = await response.json();

                const postResponse: PostResponse = {
                    id: postDetails.id,
                    postId: data.id,
                    releaseURL: `https://discord.com/channels/${data.guild_id || '@me'}/${channelId}/${data.id}`,
                    status: 'published',
                };

                this.emit('discord:post:published', { postId: postResponse.postId, response: data });
                return postResponse;
            }
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('discord:post:failed', { error: (error as Error).message });
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
                throw new Error('Message ID is required for updating');
            }

            const settings = postDetails.settings as any;
            const channelId = settings?.channelId || socialMediaAccount.metadata?.channelId;

            if (!channelId) {
                throw new Error('Channel ID is required');
            }

            const messagePayload: any = {
                content: postDetails.content,
            };

            if (settings?.embeds && Array.isArray(settings.embeds)) {
                messagePayload.embeds = settings.embeds;
            }

            const response = await fetch(
                `https://discord.com/api/v10/channels/${channelId}/messages/${postDetails.postId}`,
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messagePayload),
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Discord API error: ${error}`);
            }

            const data = await response.json();

            const postResponse: PostResponse = {
                id: postDetails.id,
                postId: data.id,
                releaseURL: `https://discord.com/channels/${data.guild_id || '@me'}/${channelId}/${data.id}`,
                status: 'published',
            };

            this.emit('discord:post:updated', { postId: postResponse.postId, postDetails });
            return postResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: postDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('discord:post:update:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }

    override async addComment(
        postDetails: PostWithAllData,
        commentDetails: PostDetails,
        socialMediaAccount: SocialMediaAccount
    ): Promise<PostResponse> {
        try {
            // Discord doesn't have traditional comments, but we can reply to a message
            // This creates a new message that references the original
            const settings = postDetails.settings as any;
            const channelId = settings?.channelId || socialMediaAccount.metadata?.channelId;

            if (!channelId) {
                throw new Error('Channel ID is required');
            }

            const messagePayload: any = {
                content: commentDetails.message,
                message_reference: {
                    message_id: postDetails.postId,
                },
            };

            const response = await fetch(
                `https://discord.com/api/v10/channels/${channelId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${socialMediaAccount.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messagePayload),
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Discord API error: ${error}`);
            }

            const data = await response.json();

            const commentResponse: PostResponse = {
                id: commentDetails.id,
                postId: data.id,
                releaseURL: `https://discord.com/channels/${data.guild_id || '@me'}/${channelId}/${data.id}`,
                status: 'published',
            };

            this.emit('discord:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
            return commentResponse;
        } catch (error: unknown) {
            const errorResponse: PostResponse = {
                id: commentDetails.id,
                postId: '',
                releaseURL: '',
                status: 'failed',
                error: (error as Error).message,
            };
            this.emit('discord:comment:failed', { error: (error as Error).message });
            return errorResponse;
        }
    }
}
