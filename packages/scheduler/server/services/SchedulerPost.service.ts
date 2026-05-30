import { ValidationError } from '#layers/BaseShared/server/types/errors';
import { type Post, type SocialMediaAccount as Integration, type Account, type SocialMediaAccount, type PostWithAllData } from '#layers/BaseDB/db/schema';
import { EventEmitter } from 'events';
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service';
import type { PostResponse } from '#layers/BaseDB/server/services/types';

// Simplified types based on the core requirements for SchedulerPost
// Simplified types based on the core requirements for SchedulerPost
export type { Integration, PostResponse };

export type PluginPostDetails = PostWithAllData & {
  title?: string;
  settings?: Record<string, unknown>;
  postId?: string;
  releaseURL?: string;
};

export type PluginSocialMediaAccount = SocialMediaAccount & {
  metadata?: Record<string, unknown>;
  username?: string;
  picture?: string;
};

// PostResponse is now imported from '#layers/BaseDB/server/services/types'
// to avoid circular dependency (db → scheduler)

// Unified comment shape — all plugin getComments() methods return this
export interface PlatformComment {
  id: string;
  text: string;
  authorName: string;
  authorId?: string;
  authorPicture?: string;
  createdAt: string;
  likeCount?: number;
  replyCount?: number;
  parentId?: string; // if this is a reply, parentId is the root comment id
}

export interface GetCommentsResponse {
  platform: string;
  postId: string;
  comments: PlatformComment[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface ReplyCommentResponse {
  success: boolean;
  comment?: PlatformComment;
  error?: string;
}

// Unified platform statistics interface — all plugin getStatistic() methods return this shape
export interface PlatformStats {
  platform: string
  accountId: string
  username: string
  picture?: string
  fetchedAt: string
  // Core social metrics
  followers?: number
  following?: number
  posts?: number
  // Engagement metrics
  engagement?: {
    total: number
    likes?: number
    comments?: number
    shares?: number
    views?: number
    reach?: number
    impressions?: number
  }
  // Growth metrics (change over last 7 days or available period)
  growth?: {
    followers?: { absolute: number; percentage: number }
    following?: { absolute: number; percentage: number }
    posts?: { absolute: number; percentage: number }
    engagement?: { absolute: number; percentage: number }
  }
  // Platform-specific extra data
  extra?: Record<string, unknown>
}

export type PollDetails = {
  options: string[]; // Array of poll options
  duration: number; // Duration in hours for which the poll will be active
};

export type MediaContent = {
  type: 'image' | 'video';
  path: string;
  alt?: string;
  thumbnail?: string;
  thumbnailTimestamp?: number;
};

export type PostDetails<T = Record<string, unknown>> = {
  id: string;
  message: string;
  settings: T;
  media?: MediaContent[];
  poll?: PollDetails;
  comments?: PostDetails[];
  platformSettings?: Record<string, unknown>;
  platformContent?: Record<string, { content: string; comments?: string[] }>;
  postFormat?: 'post' | 'reel' | 'story' | 'short';
};


export interface SchedulerPlugin {
  readonly pluginName: string;
  readonly exposedMethods?: readonly string[];
  maxConcurrentJob?: number;
  [key: string]: unknown;

  onRegister?(scheduler: SchedulerPost): void;
  onDestroy?(): void;

  validate(postDetail: Post): Promise<string[]>;
  post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse>;
  update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse>;
  addComment(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse>;
  getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats>;
  getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse>;
  replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse>;
}

export interface SchedulerPluginConstructor {
  new(scheduler: SchedulerPost, options?: Record<string, unknown>): BaseSchedulerPlugin;
  pluginName: string;
}

export abstract class BaseSchedulerPlugin implements SchedulerPlugin {
  abstract readonly pluginName: string;
  public scheduler: SchedulerPost;
  public exposedMethods?: readonly (string & keyof this)[];
  maxConcurrentJob?: number;
  [key: string]: unknown;

  // Optional methods
  onRegister?(scheduler: SchedulerPost): void;
  onDestroy?(): void;

  constructor(scheduler: SchedulerPost, options?: Record<string, unknown>) {
    this.scheduler = scheduler;
    this.init(options);
  }

  protected abstract init(options?: Record<string, unknown>): void;

  protected emit(event: string, ...args: unknown[]) {
    this.scheduler.emit(event, ...args);
  }

  protected async logPluginEvent(
    action: string,
    status: 'success' | 'failure' | 'pending',
    details: string,
    targetId?: string,
    additionalDetails?: Record<string, unknown>
  ) {
    await logAuditService.logAuditEvent({
      category: 'plugin',
      action: `${this.pluginName}-${action}`,
      targetType: this.pluginName,
      targetId: targetId || action,
      status,
      details: `${details}${additionalDetails ? `, Additional: ${JSON.stringify(additionalDetails)}` : ''}`
    });
  }

  abstract validate(postDetail: Post): Promise<string[]>;
  abstract post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse>;
  abstract update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse>;
  abstract addComment(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse>;
  abstract getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats>;
  abstract getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse>;
  abstract replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse>;
}

export class SchedulerPost extends EventEmitter {
  private post: Post | null = null;
  private accounts: Account[] | null = null;

  private plugins: Map<string, SchedulerPlugin> = new Map();
  [key: string]: unknown;

  constructor({ post, accounts }: { post?: Post, accounts?: Account[] }) {
    super();
    if (post) {
      this.post = post;
    }
    if (accounts) {
      this.accounts = accounts;
    }
  }




  use(pluginClass: SchedulerPluginConstructor, options?: Record<string, unknown>): this {
    const pluginName = pluginClass.pluginName;
    if (this.plugins.has(pluginName)) {
      throw new Error(`Plugin ${pluginName} already registered`);
    }

    const plugin = new pluginClass(this, options);
    this.plugins.set(pluginName, plugin);
    plugin.onRegister?.(this);

    const exposedMethods = plugin.exposedMethods || [];
    exposedMethods.forEach(method => {
      if (!(plugin)[method]) {
        throw new Error(`Method ${method} not found on plugin ${pluginName}`);
      }
      this[method] = (plugin[method] as Function).bind(plugin, [...arguments]);
    });

    return this;
  }

  getPlugin(name: string): SchedulerPlugin | undefined {
    return this.plugins.get(name);
  }

  destroy() {
    this.plugins.forEach(plugin => plugin.onDestroy?.());
    this.plugins.clear();
  }

  async validate(postDetails: Post): Promise<{ [pluginName: string]: string[] }> {
    const errors: { [pluginName: string]: string[] } = {};
    for (const [pluginName, plugin] of this.plugins.entries()) {
      const pluginErrors = await plugin.validate(postDetails);
      if (pluginErrors.length > 0) {
        errors[pluginName] = pluginErrors;
      }
    }
    return errors;
  }

  private async executeOnPlugins(
    action: 'post' | 'update' | 'addComment',
    params: unknown[],
    socialMediaAccount: PluginSocialMediaAccount,
    eventPrefix: string,
    extraData: Record<string, unknown> = {}
  ): Promise<PostResponse> {
    const plugin = this.plugins.get(socialMediaAccount.platform);
    if (plugin) {
      try {
        const responses = await (plugin[action] as unknown as (...args: unknown[]) => Promise<PostResponse>)(...params, socialMediaAccount);
        this.emit(`${eventPrefix}:published`, { socialMediaAccountId: socialMediaAccount.accountId, responses, ...extraData });
        return responses;
      } catch (error: unknown) {
        this.emit(`${eventPrefix}:failed`, {
          ...extraData,
        });
        throw error;
      }
    } else {
      this.emit(`${eventPrefix}:failed`, {
        pluginName: socialMediaAccount.platform,
        error: 'Plugin not registered for this socialMediaAccount',
        socialMediaAccountId: socialMediaAccount.id,
        ...extraData,
      });
      throw new Error('Plugin not registered for this socialMediaAccount');
    }
  }

  async publish(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {

    const validationErrors = await this.validate(postDetails);
    if (Object.keys(validationErrors).length > 0) {
      this.emit('post:validation-failed', validationErrors);
      throw new Error('Post validation failed' + JSON.stringify(validationErrors));
    }

    return this.executeOnPlugins('post', [postDetails, comments, socialMediaAccount], socialMediaAccount, 'post', { postDetails, comments });
  }

  async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    return this.executeOnPlugins('update', [postDetails, comments, socialMediaAccount], socialMediaAccount, 'post:update', { postDetails, comments });
  }

  async addComment(
    postDetails: PluginPostDetails,
    comment: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    return this.executeOnPlugins('addComment', [postDetails, comment, socialMediaAccount], socialMediaAccount, 'comment:add', { postDetails, comment });
  }

  async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    const plugin = this.plugins.get(socialMediaAccount.platform);
    if (plugin) {
      try {
        const stats = await plugin.getStatistic(postDetails, socialMediaAccount);
        return stats;
      } catch (error: unknown) {
        throw error;
      }
    } else {
      throw new Error('Plugin not registered for this socialMediaAccount');
    }
  }

  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    const plugin = this.plugins.get(socialMediaAccount.platform);
    if (plugin) {
      return plugin.getComments(postDetails, socialMediaAccount, options);
    }
    throw new Error('Plugin not registered for this socialMediaAccount');
  }

  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    const plugin = this.plugins.get(socialMediaAccount.platform);
    if (plugin) {
      return plugin.replyToComment(postDetails, socialMediaAccount, commentId, replyText);
    }
    throw new Error('Plugin not registered for this socialMediaAccount');
  }

  async getPostInsights(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<Record<string, unknown>> {
    const plugin = this.plugins.get(socialMediaAccount.platform);
    if (!plugin) {
      throw new Error('Plugin not registered for this socialMediaAccount');
    }
    const method = plugin['getPostInsights'];
    if (typeof method !== 'function') {
      throw new Error(`Platform ${socialMediaAccount.platform} does not support getPostInsights`);
    }
    return method.call(plugin, postDetails, socialMediaAccount);
  }
}
