import { decryptKey } from '#layers/BaseAuth/server/utils/AuthHelpers';
import type { PostResponse } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { BaseSchedulerPlugin, type PluginPostDetails, type PluginSocialMediaAccount } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { Post, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import { AtpAgent, RichText, AppBskyFeedPost, AppBskyFeedDefs, BlobRef } from '@atproto/api';
import type { BlueskySettings } from '#layers/BaseScheduler/shared/platformSettings';
import { platformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';
import { promises as fs } from 'node:fs'


type AppBskyEmbedVideo = any;
type AppBskyVideoDefs = any;

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

  private normalizeContent(content: string): string {
    if (!content) return '';
    return content
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }

  private getPlatformData(postDetails: PluginPostDetails, platformPost?: any) {
    const platformName = this.pluginName;
    const platformPostSettings = platformPost?.platformSettings || {};
    const platformContent = platformPostSettings?.platformContent ||
      (postDetails as any).platformContent?.[platformName];
    const platformSettings = platformPostSettings ||
      (postDetails as any).platformSettings?.[platformName] as BlueskySettings | undefined;

    const rawContent = platformContent?.content || postDetails.content;
    const postFormat = platformSettings?.postFormat ||
      platformPostSettings?.postFormat ||
      (postDetails as any).postFormat || 'post';

    return {
      content: this.normalizeContent(rawContent),
      settings: platformSettings,
      postFormat: postFormat
    };
  }

  public override exposedMethods = [
    'blueSkyMaxLength',
    'getProfile',
    'getPostThread',
    'getNotifications',
    'listNotifications',
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
    const pwd = await decryptKey(socialMediaAccount.accessToken);


    await this.agent.login({
      identifier: socialMediaAccount.accountName,
      password: pwd,
    });
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      await this.login(socialMediaAccount); // Ensure agent is logged in

      const { content, settings } = this.getPlatformData(postDetails);

      const richText = new RichText({ text: content });
      await richText.detectFacets(this.agent);

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
          const imageUrl = getFileFromAsset(asset);
          const { buffer, width, height } = await reduceImageBySize(imageUrl);
          const uploaded = await this.agent.uploadBlob(buffer);
          return {
            width,
            height,
            uploaded,
            filename: asset.filename || '',
          };
        })
      );

      // Upload videos (only one video per post is supported by Bluesky)
      let videoEmbed: AppBskyEmbedVideo | null = null;
      if (videoAssets.length > 0 && videoAssets[0]) {
        const videoUrl = getFileFromAsset(videoAssets[0]);
        videoEmbed = await this.uploadVideo(this.agent, videoUrl);
      }

      // Determine embed based on media types
      let embed: any = {};
      if (videoEmbed) {
        embed = videoEmbed;
      } else if (images.length > 0) {
        embed = {
          $type: 'app.bsky.embed.images',
          images: images.map(({ uploaded, width, height, filename }) => ({
            alt: filename,
            image: uploaded.data.blob,
            aspectRatio: {
              width,
              height,
            },
          })),
        };
      }

      const postRecord: AppBskyFeedPost.Record = {
        $type: 'app.bsky.feed.post',
        text: richText.text,
        facets: richText.facets,
        createdAt: new Date().toISOString(),
        ...(Object.keys(embed).length > 0 ? { embed } : {}),
      };

      const blueskyResponse = await this.agent.api.app.bsky.feed.post.create(
        { repo: this.agent.session?.did || '' },
        postRecord,
      );


      // Add comments
      const postComments = (postDetails.platformContent as Record<string, string[]>).comments ?? [];
      if (postComments.length > 0) {
        await this.addComments(blueskyResponse.uri, postComments, postDetails);
      }



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
  async addComments(postUri: string, comments: string[], postDetails: PluginPostDetails) {
    // Get the thread information for the parent post
    const threadResponse = await this.agent.getPostThread({ uri: postUri });

    // Check if thread exists and is a ThreadViewPost
    if (!threadResponse.data.thread || !AppBskyFeedDefs.isThreadViewPost(threadResponse.data.thread)) {
      throw new Error('Parent post not found or invalid type for commenting.');
    }

    const parentRecord = threadResponse.data.thread.post;

    for (const comment of comments) {
      const rt = new RichText({ text: comment });
      await rt.detectFacets(this.agent);

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

      await this.agent.api.app.bsky.feed.post.create(
        { repo: this.agent.session?.did || '' },
        commentRecord,
      );
    }
  }

  override async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {

    const publishedPlatformDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
    if (!publishedPlatformDetails) {
      throw new Error('Published platform details not found');
    }

    const publishedDetails = publishedPlatformDetails.publishDetail ? JSON.parse(publishedPlatformDetails.publishDetail as string) as PostResponse : null;
    if (!publishedDetails) {
      throw new Error('Published details not found');
    }
    const publishedPostId = publishedDetails.postId;

    const { content, settings } = this.getPlatformData(postDetails);
    const username = socialMediaAccount.username || socialMediaAccount.accountName;
    if (!publishedPostId) {
      throw new Error('Post ID is required for update');
    }


    const postRecord: AppBskyFeedPost.Record = {
      $type: 'app.bsky.feed.post',
      text: content,
      facets: [],
      createdAt: postDetails.createdAt.toISOString(),
      // embed: getEmbed(postDetails),
    };

    const rkey = publishedPostId.split('/').pop();
    if (!rkey) throw new Error('Invalid post ID');

    // Using com.atproto.repo.putRecord or generic put on the collection if convenient,
    // but assuming agent.api.app.bsky.feed.post.put exists and follows standard repo put semantics
    // app.bsky.feed.post corresponds to a collection, so .put might expect { repo, rkey, record }
    const blueskyResponse = await this.agent.api.app.bsky.feed.post.put(
      {
        repo: this.agent.session?.did || '',
        rkey: rkey,
      },
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


  }

  override async addComment(
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      await this.login(socialMediaAccount);

      const publishedPlatformDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
      if (!publishedPlatformDetails) {
        throw new Error('Published platform details not found');
      }

      const publishedDetails = publishedPlatformDetails.publishDetail ? JSON.parse(publishedPlatformDetails.publishDetail as string) as PostResponse : null;
      if (!publishedDetails) {
        throw new Error('Published details not found');
      }
      const parentUri = publishedDetails.postId;
      if (!parentUri) {
        throw new Error('Parent post ID is required for commenting');
      }

      const threadResponse = await this.agent.getPostThread({ uri: parentUri });

      // Check if thread exists and is a ThreadViewPost
      if (!threadResponse.data.thread || !AppBskyFeedDefs.isThreadViewPost(threadResponse.data.thread)) {
        throw new Error('Parent post not found or invalid type for commenting.');
      }

      const parentRecord = threadResponse.data.thread.post;

      const rt = new RichText({ text: commentDetails.content }); // commentDetails.message in old generic, content in new
      await rt.detectFacets(this.agent);

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

      this.emit('bluesky:comment:published', { commentId: response.postId, postDetails, commentDetails });
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



  async uploadVideo(
    agent: AtpAgent,
    videoPath: string
  ): Promise<AppBskyEmbedVideo> {
    const { data: serviceAuth } = await agent.com.atproto.server.getServiceAuth({
      aud: `did:web:${new URL(agent.service.toString()).host}`,
      lxm: 'com.atproto.repo.uploadBlob',
      exp: Date.now() / 1000 + 60 * 30, // 30 minutes
    });
    const video = await fs.readFile(videoPath);
    const videoData = Buffer.from(video);



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
        'Content-Length': videoData.byteLength.toString(),
      },
      body: new Blob([new Uint8Array(videoData.buffer)], { type: 'video/mp4' }),
    });

    const jobStatus = (await uploadResponse.json()) as AppBskyVideoDefs;
    let blob: BlobRef | undefined = jobStatus.blob;
    const videoAgent = new AtpAgent({ service: 'https://video.bsky.app' });

    while (!blob) {
      // Casting to any to bypass TypeScript error for 'app' property
      const { data: status } = await (videoAgent as any).app.bsky.video.getJobStatus({
        jobId: jobStatus.jobId,
      });
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

      await timer(5000); // 5 seconds check
    }
    return {
      $type: 'app.bsky.embed.video',
      video: blob,
    } satisfies AppBskyEmbedVideo;
  }

  async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<any> {
    const publishedPlatformDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
    if (!publishedPlatformDetails) {
      throw new Error('Published platform details not found');
    }

    const publishedDetails = publishedPlatformDetails.publishDetail ? JSON.parse(publishedPlatformDetails.publishDetail as string) as PostResponse : null;
    if (!publishedDetails) {
      throw new Error('Published details not found');
    }
    const publishedPostId = publishedDetails.postId;

    const thread = await this.getPostThread(publishedPostId, socialMediaAccount.accessToken);
    return thread;
  }
}
