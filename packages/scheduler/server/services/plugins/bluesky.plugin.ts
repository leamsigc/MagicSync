import { decryptKey } from '#layers/BaseAuth/server/utils/AuthHelpers';
import type { PostResponse, GetCommentsResponse, ReplyCommentResponse, PlatformComment } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { BaseSchedulerPlugin, type PluginPostDetails, type PluginSocialMediaAccount } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { Post, SocialMediaAccount, Asset, PlatformContentOverride } from '#layers/BaseDB/db/schema';
import { AtpAgent, RichText, AppBskyFeedPost, AppBskyFeedDefs, BlobRef, AppBskyVideoDefs } from '@atproto/api';
import type { BlueskySettings } from '#layers/BaseScheduler/shared/platformSettings';
import { platformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';
import { promises as fs } from 'node:fs'

import { Buffer } from 'node:buffer';
import { URL } from 'node:url';

type BlueskyPostRecord = {
  $type: string;
  text: string;
  facets?: unknown[];
  createdAt: string;
  reply?: {
    root: { uri: string; cid: string };
    parent: { uri: string; cid: string };
  };
};

type BlueskyApiComment = {
  uri: string;
  value?: {
    text?: string;
    createdAt?: string;
    reply?: {
      parent?: { uri?: string };
      root?: { uri?: string; cid?: string };
    };
  };
  author?: {
    handle?: string;
    did?: string;
    avatar?: string;
  };
  likeCount?: number;
  replyCount?: number;
};

type BlueskyAgentWithVideo = AtpAgent & {
  app: {
    bsky: {
      video: {
        getJobStatus: (params: { jobId: string }) => Promise<{ data: { jobStatus: AppBskyVideoDefs.JobStatus } }>;
      };
    };
  };
};

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

  private getPlatformData(postDetails: PluginPostDetails, platformPost?: Record<string, unknown>) {
    const platformName = this.pluginName;
    const platformContent = (postDetails.platformContent as unknown as Record<string, PlatformContentOverride | undefined>)?.[platformName];
    const platformSettings = (postDetails.platformSettings as unknown as Record<string, unknown>)?.[platformName] as BlueskySettings | undefined;
    const rawContent = platformContent?.content || postDetails.content;
    const postFormat = postDetails.postFormat ?? 'post';
    const comments = platformContent?.comments || [];

    return {
      content: this.normalizeContent(rawContent),
      settings: platformSettings,
      postFormat: postFormat,
      comments
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
  async getProfile(handle: string, accessToken?: string): Promise<{
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    followersCount: number;
    followsCount: number;
    postsCount: number;
  }> {
    if (accessToken) {
      await this.agent.login({
        identifier: handle,
        password: accessToken,
      });
    }

    const profile = await this.agent.getProfile({ actor: handle });
    const base64Avatar = profile.data.avatar
      ? await fetchedImageBase64(profile.data.avatar)
      : undefined;
    return {
      did: profile.data.did,
      handle: profile.data.handle,
      displayName: profile.data.displayName,
      description: profile.data.description,
      avatar: base64Avatar,
      followersCount: profile.data.followersCount || 0,
      followsCount: profile.data.followsCount || 0,
      postsCount: profile.data.postsCount || 0,
    };
  }

  /**
   * Get post thread with replies and engagement metrics
   */
  async getPostThread(uri: string, accessToken?: string) {
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
  ): Promise<{
    notifications: unknown[];
    cursor?: string;
  }> {
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
  ): Promise<{
    notifications: unknown[];
    cursor?: string;
  }> {
    return this.getNotifications(accessToken, options);
  }

  /**
   * Get followers list for a user
   */
  async getFollowers(
    actor: string,
    accessToken?: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<{
    followers: unknown[];
    cursor?: string;
  }> {
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
  ): Promise<{
    following: unknown[];
    cursor?: string;
  }> {
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
  ): Promise<{
    posts: unknown[];
    cursor?: string;
  }> {
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

      const { content, settings, comments: postComments } = this.getPlatformData(postDetails);

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
      let embed: Record<string, unknown> = {};
      if (videoEmbed) {
        embed = videoEmbed as Record<string, unknown>;
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
      log.error({ content: 'Bluesky post failed', plugin: 'bluesky', error: (error as Error).message });
      this.logPluginEvent('post-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id);
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
      log.error({ content: 'Bluesky comment failed', plugin: 'bluesky', error: (error as Error).message });
      this.logPluginEvent('comment-error', 'failure', `Error: ${(error as Error).message}`, commentDetails.id);
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
      const { data: status } = await (videoAgent as BlueskyAgentWithVideo).app.bsky.video.getJobStatus({
        jobId: jobStatus.jobId,
      });
      if (status.jobStatus.blob) {
        blob = status.jobStatus.blob;
      }

      if (status.jobStatus.state === 'JOB_STATE_FAILED') {
        throw new BadBody(
          'bluesky',
          JSON.stringify({}),
          {} as unknown as Response,
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
  ): Promise<PlatformStats> {
    const handle = socialMediaAccount.accountId

    const profileStats = await this.getProfile(handle, socialMediaAccount.accessToken)

    let totalEngagement = 0
    let totalPosts = 0
    let totalLikes = 0
    let totalReposts = 0
    let totalReplies = 0
    let totalQuotes = 0
    let topPosts: Array<{ uri: string; text: string; likes: number; reposts: number; replies: number }> = []

    try {
      const authorFeed = await this.agent.api.app.bsky.feed.getAuthorFeed({
        actor: handle,
        limit: 50,
      })
      const feedItems = authorFeed.data.feed || []
      totalPosts = feedItems.length
      for (const item of feedItems) {
        const post = item.post || {}
        const likeCount = post.likeCount || 0
        const repostCount = post.repostCount || 0
        const replyCount = post.replyCount || 0
        const quoteCount = post.quoteCount || 0
        const engagement = likeCount + repostCount + replyCount + quoteCount

        totalLikes += likeCount
        totalReposts += repostCount
        totalReplies += replyCount
        totalQuotes += quoteCount
        totalEngagement += engagement

        const record = post.record as { text?: string } | undefined
        topPosts.push({
          uri: post.uri,
          text: (record?.text || '').substring(0, 100),
          likes: likeCount,
          reposts: repostCount,
          replies: replyCount,
        })
      }

      topPosts.sort((a, b) => (b.likes + b.reposts + b.replies) - (a.likes + a.reposts + a.replies))
      topPosts = topPosts.slice(0, 10)
    } catch (error: unknown) {
      log.error({ content: 'Bluesky stats fetch failed', plugin: 'bluesky', error: (error as Error).message });
      this.logPluginEvent('get-stats', 'failure', `Error: ${(error as Error).message}`);
    }

    const engagementRate = profileStats.followersCount > 0 && totalPosts > 0
      ? Math.round((totalEngagement / totalPosts / profileStats.followersCount) * 10000) / 100
      : 0

    return {
      platform: 'bluesky',
      accountId: profileStats.did || socialMediaAccount.accountId,
      username: profileStats.handle || socialMediaAccount.accountName || '',
      picture: profileStats.avatar || undefined,
      fetchedAt: new Date().toISOString(),
      followers: profileStats.followersCount || 0,
      following: profileStats.followsCount || 0,
      posts: profileStats.postsCount || totalPosts,
      engagement: {
        total: totalEngagement,
        likes: totalLikes,
        comments: totalReplies,
        shares: totalReposts + totalQuotes,
      },
      growth: {
        followers: { absolute: 0, percentage: 0 },
        following: { absolute: 0, percentage: 0 },
        posts: { absolute: 0, percentage: 0 },
        engagement: { absolute: totalEngagement, percentage: engagementRate },
      },
      extra: {
        displayName: profileStats.displayName,
        totalReposts,
        totalReplies,
        totalQuotes,
        engagementRate,
        topPosts,
        postsAnalyzed: totalPosts,
      },
    }
  }

  /**
   * Transform Bluesky record to PlatformComment format
   */
  private async transformComment(record: BlueskyApiComment): Promise<PlatformComment> {
    const authorPicture = record.author?.avatar
      ? await fetchedImageBase64(record.author.avatar)
      : undefined;
    return {
      id: record.uri,
      text: record.value?.text || '',
      authorName: record.author?.handle || 'Unknown',
      authorId: record.author?.did,
      authorPicture,
      createdAt: record.value?.createdAt || '',
      likeCount: record.likeCount || 0,
      replyCount: record.replyCount || 0,
      parentId: record.value?.reply?.parent?.uri,
    };
  }

  /**
   * Get comments (posts in a thread) for a Bluesky post
   * Bluesky uses AT Protocol for data storage
   */
  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    const platformPost = postDetails.platformPosts?.find((pp: { socialAccountId: string }) => pp.socialAccountId === socialMediaAccount.id);
    const publishDetail = platformPost?.publishDetail ? JSON.parse(platformPost.publishDetail) : {};
    const externalPostId = publishDetail[socialMediaAccount.id]?.publishedId || publishDetail.postId;

    if (!externalPostId) {
      return Promise.resolve({ platform: this.pluginName, postId: '', comments: [], hasMore: false });
    }

    try {
      const agent = await this.getAuthenticatedAgent(socialMediaAccount);

      // Get post thread with replies
      const thread = await agent.api.app.bsky.feed.getPostThread({
        uri: externalPostId,
        depth: 1,
      });

      const comments: PlatformComment[] = [];
      const threadData = thread.data.thread as {
        replies?: Array<{ post: BlueskyApiComment }>;
      };

      // Get replies from the thread
      if (threadData.replies && Array.isArray(threadData.replies)) {
        for (const reply of threadData.replies) {
          comments.push(await this.transformComment(reply.post));
        }
      }

      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments,
        hasMore: false,
      };
    } catch (error) {
      log.error({ content: 'Error fetching Bluesky comments', plugin: 'bluesky', error: (error as Error).message });
      this.logPluginEvent('get-comments', 'failure', `Error: ${(error as Error).message}`);
      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments: [],
        hasMore: false,
      };
    }
  }

  /**
   * Reply to a comment (post) on Bluesky
   */
  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    try {
      const agent = await this.getAuthenticatedAgent(socialMediaAccount);
      const parentUri = commentId;

      const { data: parentRecord } = await agent.api.com.atproto.repo.getRecord({
        repo: parentUri.split('/')[2],
        collection: 'app.bsky.feed.post',
        rkey: parentUri.split('/').pop() || '',
      });

      const rt = new RichText({ text: replyText });
      await rt.detectFacets(agent);

      const replyRecord = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        reply: {
          root: parentRecord.value?.reply?.root || {
            uri: parentRecord.uri,
            cid: parentRecord.cid,
          },
          parent: {
            uri: parentRecord.uri,
            cid: parentRecord.cid,
          },
        },
        createdAt: new Date().toISOString(),
      };

      const response = await agent.api.app.bsky.feed.post.create(
        { repo: agent.session?.did || '' },
        replyRecord as AppBskyFeedPost.Record,
      );

      return {
        success: true,
        comment: await this.transformComment({
          uri: response.uri,
          cid: response.cid,
          author: {
            did: agent.session?.did,
            handle: agent.session?.handle,
          },
          value: replyRecord,
        }),
      };
    } catch (error) {
      log.error({ content: 'Error replying to Bluesky comment', plugin: 'bluesky', error: (error as Error).message });
      this.logPluginEvent('reply-comment-error', 'failure', `Error: ${(error as Error).message}`, commentId);
      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to comment',
      };
    }
  }
}
