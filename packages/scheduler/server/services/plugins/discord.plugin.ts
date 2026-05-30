import type { PostResponse, PluginPostDetails, PluginSocialMediaAccount, GetCommentsResponse, ReplyCommentResponse, PlatformComment, PlatformStats } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { Post } from '#layers/BaseDB/db/schema';
import type { DiscordSettings } from '#layers/BaseScheduler/shared/platformSettings';
import { BaseSchedulerPlugin, } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { platformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';

export class DiscordPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'discord';
  readonly pluginName = 'discord';

  private getPlatformData(postDetails: PluginPostDetails) {
    const platformName = this.pluginName;
    const platformContent = (postDetails.platformContent as Record<string, { content: string; comments?: string[] } | undefined>)?.[platformName];
    const platformSettings = (postDetails.platformSettings as Record<string, unknown>)?.[platformName] as DiscordSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings: platformSettings,
      postFormat: postDetails.postFormat || 'post'
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

  protected init(options?: Record<string, unknown>): void {
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
  async getGuilds(accessToken: string): Promise<Record<string, unknown>[]> {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.json() as Promise<Record<string, unknown>[]>;
  }

  /**
   * Get channels for a guild
   */
  async getChannels(guildId: string, accessToken: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.json() as Promise<Record<string, unknown>[]>;
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

      const messagePayload: Record<string, unknown> = {
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
  ): Promise<PlatformStats> {
    try {
      // Use metadata.guildCount if available (stored server count)
      const metadataGuildCount = socialMediaAccount.metadata?.guildCount;
      if (metadataGuildCount !== undefined) {
        return {
          platform: 'discord',
          accountId: socialMediaAccount.accountId,
          username: socialMediaAccount.accountName || '',
          fetchedAt: new Date().toISOString(),
          followers: metadataGuildCount,
          posts: 0,
          engagement: { total: 0 },
          growth: undefined,
          extra: {
            serverCount: metadataGuildCount,
          },
        };
      }

      // Fetch bot user info from Discord API with Bot authorization
      const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bot ${socialMediaAccount.accessToken}`,
        },
      });

      if (!response.ok) {
        // Return graceful zero fallback on API failure
        return {
          platform: 'discord',
          accountId: socialMediaAccount.accountId,
          username: socialMediaAccount.accountName || '',
          fetchedAt: new Date().toISOString(),
          followers: 0,
          posts: 0,
          engagement: { total: 0 },
          growth: undefined,
          extra: {},
        };
      }

      const botUser = await response.json();

      return {
        platform: 'discord',
        accountId: socialMediaAccount.accountId,
        username: botUser.username || socialMediaAccount.accountName || '',
        fetchedAt: new Date().toISOString(),
        followers: 0, // Discord bots don't have followers
        posts: 0,
        engagement: { total: 0 },
        growth: undefined,
        extra: {
          botId: botUser.id,
          avatar: botUser.avatar,
        },
      };
    } catch {
      // Return graceful zero fallback on any error
      return {
        platform: 'discord',
        accountId: socialMediaAccount.accountId,
        username: socialMediaAccount.accountName || '',
        fetchedAt: new Date().toISOString(),
        followers: 0,
        posts: 0,
        engagement: { total: 0 },
        growth: undefined,
        extra: {},
      };
    }
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
      const payload: Record<string, unknown> = {
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

      const messagePayload: Record<string, unknown> = {
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

  /**
   * Transform Discord message to PlatformComment format
   */
  private transformComment(message: Record<string, unknown>): PlatformComment {
    return {
      id: message.id,
      text: message.content || '',
      authorName: message.author?.username || 'Unknown',
      authorId: message.author?.id,
      authorPicture: message.author?.avatar ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png` : undefined,
      createdAt: message.timestamp,
      likeCount: 0,
      replyCount: 0,
      parentId: undefined,
    };
  }

  /**
   * Get comments for a Discord message
   * Note: Discord doesn't have traditional comments - uses threads
   */
  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    const platformPost = postDetails.platformPosts?.find((pp) => pp.socialAccountId === socialMediaAccount.id);
    const publishDetail = platformPost?.publishDetail ? JSON.parse(platformPost.publishDetail) : {};
    const externalPostId = publishDetail[socialMediaAccount.id]?.publishedId || publishDetail.postId;

    if (!externalPostId) {
      return Promise.resolve({ platform: this.pluginName, postId: '', comments: [], hasMore: false });
    }

    try {
      const { channelId, messageId } = this.parseDiscordMessageId(externalPostId);
      const settings = this.getSettings() as DiscordSettings;
      const botToken = settings.botToken;

      const response = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/threads`,
        {
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return {
          platform: this.pluginName,
          postId: externalPostId,
          comments: [],
          hasMore: false,
        };
      }

      const threadMessages = await response.json();
      const comments: PlatformComment[] = (threadMessages.messages || []).map((m) => this.transformComment(m as Record<string, unknown>));

      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments,
        hasMore: false,
      };
    } catch (error: unknown) {
      console.error('Error fetching Discord comments:', error);
      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments: [],
        hasMore: false,
      };
    }
  }

  /**
   * Reply to a message on Discord
   * Note: Discord doesn't have traditional comment replies
   */
  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    return {
      success: false,
      error: 'Discord does not support comment replies. Use messages/channels instead.',
    };
  }
}
