import type { PostResponse, PluginPostDetails, PluginSocialMediaAccount, PlatformStats, GetCommentsResponse, ReplyCommentResponse } from '#layers/BaseDB/server/services/SchedulerPost.service';
import { BaseSchedulerPlugin, extractExternalPostId } from '#layers/BaseDB/server/services/SchedulerPost.service';
import type { Post, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import type { DevNullSettings } from '#layers/BaseShared/shared/platformSettings';
import { platformConfigurations } from '#layers/BaseShared/shared/platformConstants';
import { symmetricDecrypt } from 'better-auth/crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';

const DEVNULL_URL = 'https://dev-null.sh';
const MAX_CLOCK_SKEW = 300;

function isImageAsset(asset: Asset): boolean {
  return (asset.mimeType || '').startsWith('image/');
}

function sha256File(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

function signPayload(privateKey: string, payload: string, namespace: string, tmpDir: string): string {
  const keyPath = join(tmpDir, 'devnull.key');
  const payloadPath = join(tmpDir, 'payload');
  const sigPath = payloadPath + '.sig';
  writeFileSync(keyPath, privateKey, { mode: 0o600 });
  writeFileSync(payloadPath, payload);
  execFileSync('ssh-keygen', ['-Y', 'sign', '-n', namespace, '-f', keyPath, payloadPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const sigRaw = readFileSync(sigPath, 'utf8');
  // ssh-keygen signature file: base64 between the ----- lines
  const lines = sigRaw.split(/\r?\n/);
  const b64 = lines.filter((l) => l && !l.startsWith('-----')).join('');
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) {
    throw new Error('ssh-keygen produced an unexpected signature.');
  }
  return b64;
}

export class DevNullPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'devnull';
  readonly pluginName = 'devnull';
  override maxConcurrentJob = platformConfigurations.devnull.maxConcurrentJob;

  protected init(_options?: { apiUrl?: string }): void {
    log.info({ message: 'dev-null.sh plugin initialized', detail: _options });
  }

  private getPlatformData(postDetails: PluginPostDetails) {
    const platformName = this.pluginName;
    const platformContent = (postDetails.platformContent as Record<string, { content: string } | undefined>)?.[platformName];
    return {
      content: platformContent?.content || postDetails.content || '',
      replyTo: (postDetails.settings as Record<string, unknown> | undefined)?.replyTo as string | undefined,
    };
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    const tmpDir = mkdtempSync(join(tmpdir(), 'devnull-'));
    try {
      const privateKey = await symmetricDecrypt({
        key: process.env.BETTER_AUTH_SECRET as string,
        data: socialMediaAccount.accessToken,
      });
      const { content, replyTo } = this.getPlatformData(postDetails);

      // Collect image assets (up to 3)
      const imageAssets = (postDetails.assets || []).filter(isImageAsset).slice(0, 3);

      // Download images to tmp files
      const imagePaths: string[] = [];
      for (let i = 0; i < imageAssets.length; i++) {
        const asset = imageAssets[i];
        const url = getPublicUrlForAsset(asset.url);
        if (!url) continue;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not fetch image: ${res.statusText}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = (asset.mimeType || 'image/png').includes('jpeg') ? 'jpg' : (asset.mimeType || '').includes('webp') ? 'webp' : 'png';
        const p = join(tmpDir, `image-${i + 1}.${ext}`);
        writeFileSync(p, buf);
        imagePaths.push(p);
      }

      const hasImages = imagePaths.length > 0;
      const namespace = hasImages ? 'devnull-commit-images' : 'devnull-commit';

      // Compute image hashes
      const hashes = imagePaths.map(sha256File).join(',');

      // Build nonce + timestamp
      const nonce = randomBytes(16).toString('hex');
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const safeReplyTo = replyTo || '';

      let payload: string;
      if (hasImages) {
        payload = `${timestamp}\n${nonce}\n${safeReplyTo}\n${hashes}\n${content}`;
      } else {
        payload = `${timestamp}\n${nonce}\n${safeReplyTo}\n${content}`;
      }

      const signature = signPayload(privateKey, payload, namespace, tmpDir);

      // POST
      let response: Response;
      if (hasImages) {
        const form = new FormData();
        const payloadBlob = new Blob([payload], { type: 'text/plain; charset=utf-8' });
        form.append('payload', payloadBlob, 'payload');
        for (const p of imagePaths) {
          const buf = readFileSync(p);
          const blob = new Blob([buf], { type: 'application/octet-stream' });
          form.append('images[]', blob, p.split('/').pop() || 'image.png');
        }
        response = await fetch(`${DEVNULL_URL}/api/cli/commits`, {
          method: 'POST',
          headers: { 'X-SSH-Signature': signature },
          body: form,
        });
      } else {
        response = await fetch(`${DEVNULL_URL}/api/cli/commits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-SSH-Signature': signature,
          },
          body: payload,
        });
      }

      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `dev-null.sh error (HTTP ${response.status})`);
      }

      // Extract link from response text if present
      const linkMatch = text.match(/https?:\/\/\S+/);
      const releaseURL = linkMatch ? linkMatch[0].replace(/[).,]+$/, '') : '';
      // Extract the commit UUID from the release URL so stats/insights can
      // look it up through the public read API.
      const uuidMatch = releaseURL.match(/\/commits\/([0-9a-f-]{36})/i);
      const commitId = uuidMatch ? uuidMatch[1] : (releaseURL || nonce);
      const postResponse: PostResponse = {
        id: postDetails.id,
        postId: commitId,
        releaseURL,
        status: 'published',
      };
      this.emit('devnull:post:published', { postId: postResponse.postId, response: text });
      return postResponse;
    } catch (error: unknown) {
      const raw = (error as Error)?.message || String(error);
      let friendly = raw;
      if (raw.includes('is not on the GitHub account of a /dev/null user')) {
        friendly = 'Sign in to dev-null.sh with GitHub at least once, then retry. (Your SSH key is registered on GitHub but /dev/null has no account for it yet.)';
      }
      log.error({ content: 'dev-null.sh post failed', plugin: 'devnull', error: raw });
      this.logPluginEvent('post-error', 'failure', `Error: ${raw}`, postDetails.id);
      return {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: friendly,
      };
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  override async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    // dev-null commits cannot be edited; re-post as a new commit.
    return this.post(postDetails, comments, socialMediaAccount);
  }

  override async addComment(
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    return this.post(commentDetails, [], socialMediaAccount);
  }

  override async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    const rawId = extractExternalPostId(postDetails, socialMediaAccount);
    const uuidMatch = (rawId || '').match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    const commitId = uuidMatch ? uuidMatch[1] : rawId;
    let stars = 0;
    let replies = 0;
    let body = '';
    if (commitId) {
      try {
        const res = await fetch(`https://dev-null.sh/api/v1/commits/${commitId}`);
        if (res.ok) {
          const json = await res.json() as { data?: { stars_count?: number; replies_count?: number; body?: string } };
          stars = json?.data?.stars_count ?? 0;
          replies = json?.data?.replies_count ?? 0;
          body = json?.data?.body ?? '';
        }
      } catch (e) {
        log.warn({ content: 'dev-null.sh stats fetch failed', error: (e as Error)?.message });
      }
    }
    return {
      platform: this.pluginName,
      accountId: socialMediaAccount.accountId,
      username: socialMediaAccount.accountName || socialMediaAccount.accountId,
      fetchedAt: new Date().toISOString(),
      followers: 0,
      following: 0,
      posts: 1,
      engagement: { total: stars + replies, likes: stars, comments: replies },
      extra: { body, stars, replies },
    };
  }

  override async getPostInsights(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostInsight[]> {
    const rawId = extractExternalPostId(postDetails, socialMediaAccount);
    const uuidMatch = (rawId || '').match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    const commitId = uuidMatch ? uuidMatch[1] : rawId;
    let stars = 0;
    let replies = 0;
    if (commitId) {
      try {
        const res = await fetch(`https://dev-null.sh/api/v1/commits/${commitId}`);
        if (res.ok) {
          const json = await res.json() as { data?: { stars_count?: number; replies_count?: number } };
          stars = json?.data?.stars_count ?? 0;
          replies = json?.data?.replies_count ?? 0;
        }
      } catch (e) {
        log.warn({ content: 'dev-null.sh insights fetch failed', error: (e as Error)?.message });
      }
    }
    return [
      { label: 'Stars', value: stars },
      { label: 'Replies', value: replies },
    ];
  }

  override async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    return { platform: this.pluginName, postId: postDetails.postId || '', comments: [], hasMore: false };
  }

  override async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    return { success: false, error: 'Replies are posted as new commits on dev-null.sh' };
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];
    if (!post.content || post.content.trim() === '') {
      // images-only allowed, but if no images and no content -> error
      errors.push('Commit body cannot be empty unless an image is attached.');
    }
    if (post.content && post.content.length > platformConfigurations.devnull.maxPostLength) {
      errors.push(`Commit body is too long (max ${platformConfigurations.devnull.maxPostLength} characters)`);
    }
    return Promise.resolve(errors);
  }
}
