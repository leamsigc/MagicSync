import { decryptKey } from '#layers/BaseAuth/server/utils/AuthHelpers';
import type { PostDetails, PostResponse, Integration } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import { AtpAgent, RichText, AppBskyFeedPost, AppBskyFeedDefs, BlobRef } from '@atproto/api';

type AppBskyEmbedVideo = any;
type AppBskyVideoDefs = any;


import axios from 'axios';
import sharp from 'sharp';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';

// Helper to pause execution
const timer = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Custom error for bad body responses
class BadBody extends Error {
  constructor(
    public readonly service: string,
    public readonly body: string,
    public readonly response: Response,
    message?: string,
  ) {
    super(message || `Bad body from ${service}: ${body}`);
  }
}


export class BlueskyPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'bluesky';
  readonly pluginName = 'bluesky';
  public override exposedMethods = [
    'blueSkyMaxLength',
    'getProfile',
    'getPostThread',
    'getNotifications',
    'listNotifications',
    'getFollowers',
    'getFollowing',
    'searchPosts',
  ] as const;
  private agent!: AtpAgent;
  serviceUrl!: string;

  blueSkyMaxLength() {
    return 300;
  }




  protected init(options?: { serviceUrl: string }): void {
    this.serviceUrl = options?.serviceUrl || 'https://bsky.social';
    this.agent = new AtpAgent({ service: this.serviceUrl || 'https://bsky.social' })

    console.log('Bluesky plugin initialized', this.serviceUrl);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];
    if (!post.content || post.content.trim() === '') {
      errors.push('Post message cannot be empty.');
    }
    if (post.content && post.content.length > 300) {
      errors.push('Post content is too long (max 300 characters)');
    }
    return Promise.resolve(errors);
  }

  /**
   * Get user profile with stats (followers, following, posts count)
   */
  async getProfile(handle: string, accessToken?: string): Promise<any> {
    if (accessToken) {
      await this.agent.login({
        identifier: handle,
        password: accessToken,
      });
    }

    const profile = await this.agent.getProfile({ actor: handle });
    return {
      did: profile.data.did,
      handle: profile.data.handle,
      displayName: profile.data.displayName,
      description: profile.data.description,
      avatar: profile.data.avatar,
      followersCount: profile.data.followersCount || 0,
      followsCount: profile.data.followsCount || 0,
      postsCount: profile.data.postsCount || 0,
    };
  }

  /**
   * Get post thread with replies and engagement metrics
   */
  async getPostThread(uri: string, accessToken?: string): Promise<any> {
    if (accessToken) {
      const session = JSON.parse(accessToken);
      await this.agent.resumeSession(session);
    }

    const thread = await this.agent.getPostThread({ uri });
    return thread.data;
  }

  /**
   * Get notifications (likes, reposts, follows, mentions, replies)
   */
  async getNotifications(
    accessToken: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<any> {
    const session = JSON.parse(accessToken);
    await this.agent.resumeSession(session);

    const notifications = await this.agent.listNotifications({
      limit: options?.limit || 50,
      cursor: options?.cursor,
    });

    return {
      notifications: notifications.data.notifications,
      cursor: notifications.data.cursor,
    };
  }

  /**
   * List all notifications with optional filtering
   */
  async listNotifications(
    accessToken: string,
    options?: {
      limit?: number;
      cursor?: string;
      seenAt?: string;
    }
  ): Promise<any> {
    return this.getNotifications(accessToken, options);
  }

  /**
   * Get followers list for a user
   */
  async getFollowers(
    actor: string,
    accessToken?: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<any> {
    if (accessToken) {
      const session = JSON.parse(accessToken);
      await this.agent.resumeSession(session);
    }

    const followers = await this.agent.getFollowers({
      actor,
      limit: options?.limit || 50,
      cursor: options?.cursor,
    });

    return {
      followers: followers.data.followers,
      cursor: followers.data.cursor,
    };
  }

  /**
   * Get following list for a user
   */
  async getFollowing(
    actor: string,
    accessToken?: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<any> {
    if (accessToken) {
      const session = JSON.parse(accessToken);
      await this.agent.resumeSession(session);
    }

    const following = await this.agent.getFollows({
      actor,
      limit: options?.limit || 50,
      cursor: options?.cursor,
    });

    return {
      following: following.data.follows,
      cursor: following.data.cursor,
    };
  }

  /**
   * Search for posts
   */
  async searchPosts(
    query: string,
    accessToken?: string,
    options?: {
      limit?: number;
      cursor?: string;
      sort?: 'top' | 'latest';
    }
  ): Promise<any> {
    if (accessToken) {
      const session = JSON.parse(accessToken);
      await this.agent.resumeSession(session);
    }

    const results = await this.agent.app.bsky.feed.searchPosts({
      q: query,
      limit: options?.limit || 25,
      cursor: options?.cursor,
      sort: options?.sort || 'latest',
    });

    return {
      posts: results.data.posts,
      cursor: results.data.cursor,
    };
  }
  async login(socialMediaAccount: SocialMediaAccount) {
    await this.init();
    const pwd = await  decryptKey(socialMediaAccount.accessToken);

    console.log({socialMediaAccount});

    await this.agent.login({
      identifier: socialMediaAccount.accountName,
      password: pwd,
    });
  }

  override async post(
    postDetails: PostWithAllData,
    comments: PostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      await this.login(socialMediaAccount);

      const rt = new RichText({ text: postDetails.content });
      await rt.detectFacets(this.agent);

      // Handle media from assets
      const imageAssets = postDetails.assets?.filter(
        (asset: Asset) => asset.mimeType.includes('image')
      ) || [];
      const videoAssets = postDetails.assets?.filter(
        (asset: Asset) => asset.mimeType.includes('video')
      ) || [];

      // Upload images
      const images = await Promise.all(
        imageAssets.map(async (asset: Asset) => {
          const imageUrl = `${this.serviceUrl}${asset.url}`;
          const { buffer, width, height } = await this.reduceImageBySize(imageUrl);
          return {
            width,
            height,
            buffer: await this.agent.uploadBlob(buffer),
          };
        })
      );

      // Upload videos (only one video per post is supported by Bluesky)
      let videoEmbed: AppBskyEmbedVideo | null = null;
      if (videoAssets.length > 0) {
        const videoUrl = `${this.serviceUrl}${videoAssets[0].url}`;
        videoEmbed = await this.uploadVideo(this.agent, videoUrl);
      }

      // Determine embed based on media types
      let embed: any = {};
      if (videoEmbed) {
        embed = videoEmbed;
      } else if (images.length > 0) {
        embed = {
          $type: 'app.bsky.embed.images',
          images: images.map((p: { buffer: { data: { blob: any; }; }; width: any; height: any; }, index: string | number) => ({
            alt: imageAssets?.[index]?.filename || '',
            image: p.buffer.data.blob,
            aspectRatio: {
              width: p.width,
              height: p.height,
            },
          })),
        };
      }

      const postRecord: AppBskyFeedPost.Record = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
        ...(Object.keys(embed).length > 0 ? { embed } : {}),
      };

      const blueskyResponse = await this.agent.api.app.bsky.feed.post.create(
        { repo: this.agent.session?.did || '' },
        postRecord,
      );



      const response: PostResponse = {
        id: postDetails.id,
        postId: blueskyResponse.uri,
        releaseURL: `https://bsky.app/profile/${this.agent.session?.handle}/post/${blueskyResponse.uri.split('/').pop()}`,
        status: 'published',
      };

      this.emit('bluesky:post:published', { postId: response.postId, response });
      return response;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('bluesky:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async update(
    postDetails: PostWithAllData,
    comments: PostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      await this.agent.login({
        identifier: socialMediaAccount.username,
        password: socialMediaAccount.accessToken,
      });

      // Bluesky doesn't support editing, delete and recreate
      if (postDetails.postId) {
        const rkeyToDelete = postDetails.postId.split('/').pop();
        if (this.agent.session?.did && rkeyToDelete) {
          await this.agent.api.com.atproto.repo.deleteRecord({
            repo: this.agent.session.did,
            collection: 'app.bsky.feed.post',
            rkey: rkeyToDelete,
          });
        }
      }

      // Create new post with updated content
      const rt = new RichText({ text: postDetails.content });
      await rt.detectFacets(this.agent);

      const postRecord: AppBskyFeedPost.Record = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
      };

      const blueskyResponse = await this.agent.api.app.bsky.feed.post.create(
        { repo: this.agent.session?.did || '' },
        postRecord,
      );

      const response: PostResponse = {
        id: postDetails.id,
        postId: blueskyResponse.uri,
        releaseURL: `https://bsky.app/profile/${this.agent.session?.handle}/post/${blueskyResponse.uri.split('/').pop()}`,
        status: 'published',
      };

      this.emit('bluesky:post:updated', { postId: response.postId, postDetails });
      return response;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('bluesky:post:update:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async addComment(
    postDetails: PostWithAllData,
    commentDetails: PostDetails,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    try {
      await this.agent.login({
        identifier: socialMediaAccount.username,
        password: socialMediaAccount.accessToken,
      });

      const rt = new RichText({ text: commentDetails.message });
      await rt.detectFacets(this.agent);

      const parentUri = postDetails.postId || '';
      const threadResponse = await this.agent.api.app.bsky.feed.getPostThread({ uri: parentUri });

      // Type narrowing: ensure the thread is a ThreadViewPost (which has a 'post' property)
      if (!threadResponse.data.thread || !AppBskyFeedDefs.isThreadViewPost(threadResponse.data.thread)) {
        throw new Error('Parent post not found for commenting.');
      }

      const parentRecord = threadResponse.data.thread.post as AppBskyFeedDefs.PostView;

      const commentRecord: AppBskyFeedPost.Record = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
        reply: {
          root: {
            uri: parentRecord.uri,
            cid: parentRecord.cid,
          },
          parent: {
            uri: parentRecord.uri,
            cid: parentRecord.cid,
          },
        },
      };

      const blueskyResponse = await this.agent.api.app.bsky.feed.post.create(
        { repo: this.agent.session?.did || '' },
        commentRecord,
      );

      const response: PostResponse = {
        id: commentDetails.id,
        postId: blueskyResponse.uri,
        releaseURL: `https://bsky.app/profile/${this.agent.session?.handle}/post/${blueskyResponse.uri.split('/').pop()}`,
        status: 'published',
      };

      this.emit('bluesky:comment:added', { commentId: response.postId, postDetails, commentDetails });
      return response;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: commentDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('bluesky:comment:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }


  async reduceImageBySize(url: string, maxSizeKB = 976) {
    try {
      // Fetch the image from the URL
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      let imageBuffer = Buffer.from(response.data);

      // Use sharp to get the metadata of the image
      const metadata = await sharp(imageBuffer).metadata();
      let width = metadata.width!;
      let height = metadata.height!;

      // Resize iteratively until the size is below the threshold
      while (imageBuffer.length / 1024 > maxSizeKB) {
        width = Math.floor(width * 0.9); // Reduce dimensions by 10%
        height = Math.floor(height * 0.9);

        // Resize the image
        const resizedBuffer = await sharp(imageBuffer)
          .resize({ width, height })
          .toBuffer();

        imageBuffer = resizedBuffer;

        if (width < 10 || height < 10) break; // Prevent overly small dimensions
      }

      return { width, height, buffer: imageBuffer };
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  }
  async uploadVideo(
    agent: AtpAgent,
    videoPath: string
  ): Promise<AppBskyEmbedVideo> {
    const { data: serviceAuth } = await agent.com.atproto.server.getServiceAuth({
      aud: `did:web:${new URL(agent.service.toString()).host}`,
      lxm: 'com.atproto.repo.uploadBlob',
      exp: Date.now() / 1000 + 60 * 30, // 30 minutes
    });

    async function downloadVideo(
      url: string
    ): Promise<{ video: Buffer; size: number }> {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const video = Buffer.from(arrayBuffer);
      const size = video.length;
      return { video, size };
    }

    const video = await downloadVideo(videoPath);

    console.log('Downloaded video', videoPath, video.size);

    const uploadUrl = new URL(
      'https://video.bsky.app/xrpc/app.bsky.video.uploadVideo'
    );
    uploadUrl.searchParams.append('did', agent.session!.did);
    uploadUrl.searchParams.append('name', videoPath.split('/').pop()!);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceAuth.token}`,
        'Content-Type': 'video/mp4',
        'Content-Length': video.size.toString(),
      },
      body: new Blob([new Uint8Array(video.video)], { type: 'video/mp4' }),
    });

    const jobStatus = (await uploadResponse.json()) as AppBskyVideoDefs;
    console.log('JobId:', jobStatus.jobId);
    let blob: BlobRef | undefined = jobStatus.blob;
    const videoAgent = new AtpAgent({ service: 'https://video.bsky.app' });

    while (!blob) {
      // Casting to any to bypass TypeScript error for 'app' property, as it might be a type definition issue.
      const { data: status } = await (videoAgent as any).app.bsky.video.getJobStatus({
        jobId: jobStatus.jobId,
      });
      console.log(
        'Status:',
        status.jobStatus.state,
        status.jobStatus.progress || ''
      );
      if (status.jobStatus.blob) {
        blob = status.jobStatus.blob;
      }

      if (status.jobStatus.state === 'JOB_STATE_FAILED') {
        throw new BadBody(
          'bluesky',
          JSON.stringify({}),
          {} as any,
          'Could not upload video, job failed'
        );
      }

      await timer(30000);
    }

    console.log('posting video...');

    return {
      $type: 'app.bsky.embed.video',
      video: blob,
    } satisfies AppBskyEmbedVideo;
  }
}
