import type { PostResponse, PluginPostDetails, PluginSocialMediaAccount, GetCommentsResponse, ReplyCommentResponse, PlatformComment, PlatformStats } from '../SchedulerPost.service';
import { BaseSchedulerPlugin } from '../SchedulerPost.service';
import type { Post, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import type { PinterestSettings } from '../../../shared/platformSettings';
import { platformConfigurations } from '../../../shared/platformConstants';

export class PinterestPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'pinterest';
  readonly pluginName = 'pinterest';

  private readonly API_BASE = 'https://api.pinterest.com/v5';

  private getPlatformData(postDetails: PluginPostDetails) {
    const platformName = this.pluginName;
    const platformContent = (postDetails.platformContent as Record<string, { content: string; comments?: string[] } | undefined>)?.[platformName];
    const platformSettings = (postDetails.platformSettings as Record<string, unknown>)?.[platformName] as PinterestSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings: platformSettings,
      postFormat: postDetails.postFormat || 'post'
    };
  }

  public override exposedMethods = [
    'getUser',
    'getBoards',
    'getBoardPins',
  ] as const;
  override maxConcurrentJob = platformConfigurations.pinterest.maxConcurrentJob;

  protected init(options?: Record<string, unknown>): void {
    console.log('Pinterest plugin initialized', options);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];
    if (!post.content || post.content.trim() === '') {
      errors.push('Pin description cannot be empty.');
    }
    if (post.content && post.content.length > platformConfigurations.pinterest.maxPostLength) {
      errors.push(`Pin description is too long (max ${platformConfigurations.pinterest.maxPostLength} characters)`);
    }
    return Promise.resolve(errors);
  }

  async getUser(accessToken: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.API_BASE}/user_account`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.json();
  }

  async getBoards(accessToken: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(`${this.API_BASE}/boards`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json() as { items?: Record<string, unknown>[] };
    return data.items || [];
  }

  async getBoardPins(boardId: string, accessToken: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(`${this.API_BASE}/boards/${boardId}/pins`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json() as { items?: Record<string, unknown>[] };
    return data.items || [];
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content, settings } = this.getPlatformData(postDetails);

      const imageAsset = postDetails.assets?.find((asset: Asset) =>
        asset.mimeType.includes('image')
      );

      if (!imageAsset) {
        throw new Error('At least one image is required for Pinterest pins');
      }

      const pinData: Record<string, unknown> = {
        title: settings?.title || postDetails.title || content.substring(0, 100),
        description: content || '',
        board_id: settings?.boardId,
        media_source: {
          source_type: 'image_url',
          url: getPublicUrlForAsset(imageAsset.url),
        },
      };

      if (settings?.link) {
        pinData.link = settings.link;
      }

      if (settings?.altText) {
        pinData.alt_text = settings.altText;
      }

      const response = await fetch(`${this.API_BASE}/pins`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pinData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pinterest API error: ${error}`);
      }

      const data = await response.json() as Record<string, unknown>;

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: data.id as string,
        releaseURL: `https://www.pinterest.com/pin/${data.id}/`,
        status: 'published',
      };

      this.emit('pinterest:post:published', { postId: postResponse.postId, response: data });
      return postResponse;
    } catch (error: unknown) {
      log.error({ content: 'Pinterest post failed', plugin: 'pinterest', error: (error as Error).message });
      this.logPluginEvent('post-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id);
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('pinterest:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content, settings } = this.getPlatformData(postDetails);

      if (!postDetails.postId) {
        throw new Error('Pin ID is required for updating');
      }

      const updateData: Record<string, unknown> = {};
      if (content) updateData.description = content;
      if (settings?.title) updateData.title = settings.title;
      if (settings?.link) updateData.link = settings.link;
      if (settings?.altText) updateData.alt_text = settings.altText;
      if (settings?.boardId) updateData.board_id = settings.boardId;

      const response = await fetch(`${this.API_BASE}/pins/${postDetails.postId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pinterest update error: ${error}`);
      }

      const data = await response.json() as Record<string, unknown>;

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: data.id as string,
        releaseURL: `https://www.pinterest.com/pin/${data.id}/`,
        status: 'published',
      };

      this.emit('pinterest:post:updated', { postId: postResponse.postId, postDetails });
      return postResponse;
    } catch (error: unknown) {
      log.error({ content: 'Pinterest update failed', plugin: 'pinterest', error: (error as Error).message });
      this.logPluginEvent('update-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id);
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('pinterest:post:update:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async addComment(
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    return {
      id: commentDetails.id,
      postId: '',
      releaseURL: '',
      status: 'failed',
      error: 'Pinterest does not support commenting via API',
    };
  }

  async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    try {
      const accessToken = socialMediaAccount.accessToken;
      if (!accessToken) {
        return this.createZeroStats(socialMediaAccount);
      }

      const userResponse = await fetch(`${this.API_BASE}/user_account`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!userResponse.ok) {
        log.error({ content: '[Pinterest] Failed to fetch user', status: userResponse.status });
        return this.createZeroStats(socialMediaAccount);
      }

      const userData = await userResponse.json() as Record<string, unknown>;

      let totalEngagement = 0
      let totalPins = 0
      let totalSaves = 0
      let totalImpressions = 0
      let totalClicks = 0
      let boardData: Array<{ id: string; name: string; pinCount: number }> = []

      try {
        const boardsResponse = await fetch(`${this.API_BASE}/boards`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (boardsResponse.ok) {
          const boardsJson = await boardsResponse.json() as { items?: Array<Record<string, unknown>> }
          const boards = boardsJson.items || []

          for (const board of boards) {
            const boardId = board.id as string
            const boardName = board.name as string

            try {
              const pinsResponse = await fetch(`${this.API_BASE}/boards/${boardId}/pins`, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              })

              if (pinsResponse.ok) {
                const pinsJson = await pinsResponse.json() as { items?: Array<Record<string, unknown>> }
                const pins = pinsJson.items || []
                boardData.push({
                  id: boardId,
                  name: boardName,
                  pinCount: pins.length,
                })
                totalPins += pins.length

                for (const pin of pins) {
                  totalSaves += (pin as Record<string, number>).save_count || 0
                  totalImpressions += (pin as Record<string, number>).impression_count || 0
                  totalClicks += (pin as Record<string, number>).click_count || 0
                  totalEngagement += ((pin as Record<string, number>).save_count || 0) + ((pin as Record<string, number>).click_count || 0)
                }
              }
            } catch (error: unknown) {
              log.error({ content: 'Pinterest board pins fetch failed', plugin: 'pinterest', error: (error as Error).message });
            }
          }
        }
      } catch (error: unknown) {
        log.error({ content: 'Pinterest boards fetch failed', plugin: 'pinterest', error: (error as Error).message });
      }

      const base64Picture = userData.profile_image
        ? await fetchedImageBase64(userData.profile_image as string)
        : undefined

      const followersCount = (userData.followers_count as number) || 0
      const engagementRate = followersCount > 0 && totalPins > 0
        ? Math.round((totalEngagement / totalPins / followersCount) * 10000) / 100
        : 0

      return {
        platform: 'pinterest',
        accountId: String(userData.username || socialMediaAccount.accountId),
        username: String(userData.username || socialMediaAccount.accountName || ''),
        picture: base64Picture,
        fetchedAt: new Date().toISOString(),
        followers: followersCount,
        following: (userData.following_count as number) || 0,
        posts: (userData.board_count as number) || 0,
        engagement: {
          total: totalEngagement,
          impressions: totalImpressions,
          saves: totalSaves,
        },
        growth: {
          followers: { absolute: 0, percentage: 0 },
          posts: { absolute: 0, percentage: 0 },
          engagement: { absolute: totalEngagement, percentage: engagementRate },
        },
        extra: {
          fullName: userData.full_name,
          boardCount: userData.board_count,
          pinCount: userData.pin_count,
          totalPins,
          totalSaves,
          totalImpressions,
          totalClicks,
          engagementRate,
          boards: boardData,
          boardsAnalyzed: boardData.length,
        },
      }
    } catch (error: unknown) {
      log.error({ content: 'Pinterest Error fetching stats', plugin: 'pinterest', error: (error as Error).message });
      this.logPluginEvent('get-stats', 'failure', `Error: ${(error as Error).message}`);
      return this.createZeroStats(socialMediaAccount);
    }
  }

  private createZeroStats(socialMediaAccount: PluginSocialMediaAccount): PlatformStats {
    return {
      platform: 'pinterest',
      accountId: socialMediaAccount.accountId,
      username: socialMediaAccount.accountName || socialMediaAccount.accountId,
      fetchedAt: new Date().toISOString(),
      followers: 0,
      following: 0,
      posts: 0,
      engagement: { total: 0 },
    };
  }

  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    return Promise.resolve({
      platform: this.pluginName,
      postId: '',
      comments: [],
      hasMore: false,
    });
  }

  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    return {
      success: false,
      error: 'Pinterest does not support comment replies via API',
    };
  }
}
