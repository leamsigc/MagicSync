import type { PostResponse, PluginPostDetails, PluginSocialMediaAccount } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { Post } from '#layers/BaseDB/db/schema';
import type { DiscordSettings } from '#layers/BaseScheduler/shared/platformSettings';
import { BaseSchedulerPlugin, } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { platformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';

export class DiscordPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'discord';
  readonly pluginName = 'discord';

  private getPlatformData(postDetails: PluginPostDetails) {
    const platformName = this.pluginName;
    const platformContent = (postDetails as any).platformContent?.[platformName];
    const platformSettings = (postDetails as any).platformSettings?.[platformName] as DiscordSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings: platformSettings,
      postFormat: (postDetails as any).postFormat || 'post'
    };
  }

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
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content, settings } = this.getPlatformData(postDetails);

      // Fetch guildID and channelID appropriately
      // Prioritize settings.channelId, then socialMediaAccount.metadata.channelId, then socialMediaAccount.accountId
      const channelId = settings?.channelId || socialMediaAccount.metadata?.channelId || socialMediaAccount.accountId;
      if (!channelId) {
        throw new Error('Channel ID is required. Please configure it in account settings.');
      }

      const messagePayload: any = {
        content: content,
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
          if (!asset) continue;
          const fileResponse = await fetch(getPublicUrlForAsset(asset.url));
          const fileBlob = await fileResponse.blob();
          formData.append(`files[${i}]`, fileBlob, asset.filename);
        }

        const response = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bot ${socialMediaAccount.accessToken}`,
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
              Authorization: `Bot ${socialMediaAccount.accessToken}`,
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

  async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<any> {
    const publicationDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
    if (!publicationDetails) {
      throw new Error('Published platform details not found');
    }
    const details = JSON.parse(publicationDetails.publishDetail as unknown as string || '{}') as PostResponse;
    const postId = details.postId;
    if (!postId) {
      throw new Error('Post details not found');
    }

    const match = details.releaseURL.match(/channels\/[\w@]+\/(\d+)\/\d+/);
    // Try to extract channelId from releaseURL if possible, or fallback
    // Release URL format: https://discord.com/channels/{guildId}/{channelId}/{messageId}
    const channelId = match ? match[1] : (postDetails.settings as any)?.channelId || socialMediaAccount.metadata?.channelId || socialMediaAccount.accountId;

    if (!channelId) {
      throw new Error('Channel ID not found for statistics');
    }

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${postId}`, {
      headers: {
        Authorization: `Bot ${socialMediaAccount.accessToken}`,
      },
    });
    return response.json();
  }

  override async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content, settings } = this.getPlatformData(postDetails);

      const publicationDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
      if (!publicationDetails) {
        throw new Error('Published platform details not found');
      }
      const details = JSON.parse(publicationDetails.publishDetail as unknown as string || '{}') as PostResponse;
      const postId = details.postId;

      if (!postId) {
        throw new Error('Message ID is required for update');
      }

      // Prefer channelId from settings, fall back to metadata or account info
      // In Discord, you usually post to a specific channel. The account might be linked to a guild/user.
      // Metadata usually stores the selected channel ID from connection time or UI selection.
      const channelId = settings?.channelId || socialMediaAccount.metadata?.channelId || socialMediaAccount.accountId;

      if (!channelId) {
        throw new Error('Discord Channel ID is required');
      }

      // Construct payload
      const payload: any = {
        content: content,
        // embeds: settings?.embeds, // Removed as embeds is not on DiscordSettings currently
      };

      const response = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${postId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bot ${socialMediaAccount.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
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
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      // Discord doesn't have traditional comments, but we can reply to a message
      // This creates a new message that references the original
      const { content } = this.getPlatformData(commentDetails);
      const settings = postDetails.settings;
      const channelId = settings?.channelId || socialMediaAccount.metadata?.channelId || socialMediaAccount.accountId;

      if (!channelId) {
        throw new Error('Channel ID is required');
      }

      const publicationDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
      if (!publicationDetails) {
        throw new Error('Published platform details not found');
      }
      const details = JSON.parse(publicationDetails.publishDetail as unknown as string || '{}') as PostResponse;
      const postId = details.postId;

      if (!postId) {
        throw new Error('Post ID is required for commenting');
      }

      const messagePayload: any = {
        content: content,
        message_reference: {
          message_id: postId,
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
