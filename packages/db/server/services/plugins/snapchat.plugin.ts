import { platformConfigurations } from '#layers/BaseShared/shared/platformConstants';
import {
  BaseSchedulerPlugin,
  createPostInsightsFallback,
  extractExternalPostId,
} from '#layers/BaseDB/server/services/SchedulerPost.service';
import type {
  GetCommentsResponse,
  PlatformStats,
  PluginPostDetails,
  PluginSocialMediaAccount,
  PostInsight,
  PostResponse,
  ReplyCommentResponse,
} from '#layers/BaseDB/server/services/SchedulerPost.service';
import type { Post, Asset, PlatformContentOverride } from '#layers/BaseDB/db/schema';
import type { SnapchatSettings } from '#layers/BaseShared/shared/platformSettings';
import { readFile } from 'node:fs/promises';

/**
 * Snapchat publishing.
 *
 * Snapchat has no public API for posting to a personal story — the Snap Kit
 * *Creative Kit* is a client-side (mobile) share sheet. The only server-side
 * content surface is the **Marketing API**, which uploads media and creates a
 * creative under an organization ad account. This plugin implements that path,
 * and requires the ad account id to be configured on the connection (settings
 * or `baseUrl`); without it, `post` fails with an actionable message instead of
 * guessing.
 *
 * Access tokens come from the Snapchat genericOAuth provider in
 * `packages/auth/lib/auth.ts` with the `snapchat-marketing-api` scope.
 * Dev keys: https://kit.snapchat.com/portal
 */

const SNAPCHAT_API = 'https://adsapi.snapchat.com/v1';

/**
 * An ad account id is interpolated into the request path, so anything that is
 * not a plain id is rejected rather than allowed to reshape the URL.
 */
const AD_ACCOUNT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Never let an asset's display name decide the multipart filename. */
function safeUploadName(filename: string | null | undefined): string {
  const cleaned = (filename ?? '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
  return cleaned || 'snap-media';
}

interface SnapchatMediaEnvelope {
  media?: Array<{ media?: { id?: string } }>;
}

interface SnapchatCreativeEnvelope {
  creatives?: Array<{ creative?: { id?: string } }>;
}

export class SnapchatPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'snapchat';
  readonly pluginName = 'snapchat';

  override maxConcurrentJob = platformConfigurations.snapchat.maxConcurrentJob;

  protected init(options?: Record<string, unknown>): void {
    log.info({ message: 'Snapchat plugin initialized', detail: options });
  }

  /** Where a creative lands: explicit settings, then the connection URL. */
  private adAccountId(socialMediaAccount: PluginSocialMediaAccount, settings?: SnapchatSettings): string {
    const candidate = settings?.adAccountId || socialMediaAccount.baseUrl || socialMediaAccount.accountId;
    if (!candidate || !AD_ACCOUNT_ID.test(candidate)) return '';
    return candidate;
  }

  private getPlatformData(postDetails: PluginPostDetails) {
    const platformContent = (postDetails.platformContent as Record<string, PlatformContentOverride | undefined>)?.[this.pluginName];
    const settings = (postDetails.platformSettings as Record<string, unknown>)?.[this.pluginName] as SnapchatSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings,
      postFormat: postDetails.postFormat ?? 'post',
    };
  }

  private async accessToken(socialMediaAccount: PluginSocialMediaAccount): Promise<string> {
    // Already decrypted by socialMediaAccountService at the read boundary.
    return socialMediaAccount.accessToken;
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];
    const max = platformConfigurations.snapchat.maxPostLength;
    if (!post.content || post.content.trim() === '') {
      errors.push('Post content cannot be empty.');
    }
    if (post.content && post.content.length > max) {
      errors.push(`Post content is too long (max ${max} characters)`);
    }
    return Promise.resolve(errors);
  }

  /** Upload one asset to the Marketing API and return the media id. */
  private async uploadMedia(accessToken: string, asset: Asset): Promise<string> {
    const filePath = getFileFromAsset(asset);
    const bytes = await readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)], { type: asset.mimeType || 'video/mp4' }), safeUploadName(asset.filename));

    const response = await fetch(`${SNAPCHAT_API}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Snapchat media upload failed: ${await response.text()}`);
    }
    const body = await response.json() as SnapchatMediaEnvelope;
    const mediaId = body.media?.[0]?.media?.id;
    if (!mediaId) throw new Error('Snapchat media upload returned no media id');
    return mediaId;
  }

  private async createCreative(
    accessToken: string,
    adAccountId: string,
    topSnapMediaId: string,
    settings: SnapchatSettings | undefined,
    content: string,
  ): Promise<string> {
    const response = await fetch(`${SNAPCHAT_API}/adaccounts/${adAccountId}/creatives`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatives: [{
          name: content.slice(0, 34) || 'MagicSync creative',
          type: 'SNAP_AD',
          headline: (settings?.headline || content).slice(0, 34),
          brand_name: settings?.brandName || '',
          shareable: true,
          top_snap_media_id: topSnapMediaId,
        }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Snapchat creative creation failed: ${await response.text()}`);
    }
    const body = await response.json() as SnapchatCreativeEnvelope;
    const creativeId = body.creatives?.[0]?.creative?.id;
    if (!creativeId) throw new Error('Snapchat creative creation returned no id');
    return creativeId;
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount,
  ): Promise<PostResponse> {
    try {
      const { content, settings } = this.getPlatformData(postDetails);
      const adAccountId = this.adAccountId(socialMediaAccount, settings);
      if (!adAccountId) {
        throw new Error('Snapchat needs an ad account id on the connection (Snapchat Marketing API). See the Snapchat setup guide.');
      }
      const asset = postDetails.assets?.[0];
      if (!asset) {
        throw new Error('Snapchat publishing requires one image or video.');
      }

      const accessToken = await this.accessToken(socialMediaAccount);
      const mediaId = await this.uploadMedia(accessToken, asset);
      const creativeId = await this.createCreative(accessToken, adAccountId, mediaId, settings, content);

      const response: PostResponse = {
        id: postDetails.id,
        postId: creativeId,
        releaseURL: `https://ads.snapchat.com/${adAccountId}/creatives/${creativeId}`,
        status: 'published',
      };
      this.emit('snapchat:post:published', { postId: creativeId, response });
      return response;
    }
    catch (error: unknown) {
      const message = (error as Error).message;
      log.error({ message: 'Snapchat post failed', plugin: 'snapchat', error: message });
      this.logPluginEvent('post-error', 'failure', `Error: ${message}`, postDetails.id);
      this.emit('snapchat:post:failed', { error: message });
      return { id: postDetails.id, postId: '', releaseURL: '', status: 'failed', error: message };
    }
  }

  /** Snapchat creatives are immutable once created. */
  override async update(
    postDetails: PluginPostDetails,
    _comments: PluginPostDetails[],
    _socialMediaAccount: PluginSocialMediaAccount,
  ): Promise<PostResponse> {
    return {
      id: postDetails.id,
      postId: '',
      releaseURL: '',
      status: 'failed',
      error: 'Snapchat creatives cannot be edited. Create a new post instead.',
    };
  }

  /** Snapchat has no public comment API. */
  override async addComment(
    postDetails: PluginPostDetails,
    _comments: PluginPostDetails,
    _socialMediaAccount: PluginSocialMediaAccount,
  ): Promise<PostResponse> {
    return {
      id: postDetails.id,
      postId: '',
      releaseURL: '',
      status: 'failed',
      error: 'Snapchat does not support comments through the API.',
    };
  }

  async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
  ): Promise<PlatformStats> {
    const base: PlatformStats = {
      platform: 'snapchat',
      accountId: socialMediaAccount.accountId,
      username: socialMediaAccount.accountName || socialMediaAccount.accountId,
      picture: socialMediaAccount.picture ?? undefined,
      fetchedAt: new Date().toISOString(),
      followers: 0,
      posts: 0,
      engagement: { total: 0 },
      growth: {
        followers: { absolute: 0, percentage: 0 },
        posts: { absolute: 0, percentage: 0 },
        engagement: { absolute: 0, percentage: 0 },
      },
      extra: { note: 'Snapchat exposes no follower metrics through the public API' },
    }

    try {
      const adAccountId = this.adAccountId(socialMediaAccount)
      if (!adAccountId) return base
      const accessToken = await this.accessToken(socialMediaAccount)
      const response = await fetch(`${SNAPCHAT_API}/adaccounts/${adAccountId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) return base
      const body = await response.json() as { adaccounts?: Array<{ adaccount?: { name?: string } }> }
      base.username = body.adaccounts?.[0]?.adaccount?.name || base.username
      return base
    }
    catch (error: unknown) {
      log.error({ message: 'Snapchat stats fetch failed', plugin: 'snapchat', error: (error as Error).message })
      this.logPluginEvent('get-stats', 'failure', `Error: ${(error as Error).message}`)
      return base
    }
  }

  async getPostInsights(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
  ): Promise<PostInsight[]> {
    // Snapchat reports creative performance in Ads Manager; the public API
    // exposes no per-creative metrics, so there is nothing honest to show here.
    const externalPostId = extractExternalPostId(postDetails, socialMediaAccount)
    if (!externalPostId) return createPostInsightsFallback(this.pluginName)
    return createPostInsightsFallback(this.pluginName)
  }

  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
  ): Promise<GetCommentsResponse> {
    const postId = extractExternalPostId(postDetails, socialMediaAccount) ?? ''
    return { platform: this.pluginName, postId, comments: [], hasMore: false }
  }

  async replyToComment(
    _postDetails: PluginPostDetails,
    _socialMediaAccount: PluginSocialMediaAccount,
    _commentId: string,
    _replyText: string,
  ): Promise<ReplyCommentResponse> {
    return { success: false, error: 'Snapchat does not support comment replies through the API.' }
  }
}
